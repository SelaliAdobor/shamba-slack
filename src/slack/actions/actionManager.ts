import Redis from "ioredis";
import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient, WebAPICallResult } from "@slack/client";
import { SlackInteractiveActionPayload } from "../slackUtils";
import { logger, redis } from "../../server";
import uuid from "uuid/v4";
type ActionCallback = (
  payload: SlackInteractiveActionPayload,
  reply: fastify.FastifyReply<ServerResponse>
) => Promise<void>;

class ActionManager {
  constructor() {}
  callbacks: ActionCallback[] = [];
  contextCacheTtl = 60 * 5;
  private getRedisKeyForContext = (contextId: string) =>
    `slack-interaction-context:${contextId}`;

  async setInteractionContext<T>(
    interactionType: string,
    context: T
  ): Promise<string> {
    let contextId = `${interactionType}:${uuid()}`;
    let redisKey = this.getRedisKeyForContext(contextId);
    await redis.set(
      redisKey,
      JSON.stringify(context),
      "ex",
      this.contextCacheTtl
    );
    return contextId;
  }

  async getInteractionContext<T>(contextId: string): Promise<T | null> {
    let context = await redis.get(this.getRedisKeyForContext(contextId));
    if (context == null) {
      return null;
    }
    return JSON.parse(context);
  }
  listenForSlackInteractions(callback: ActionCallback): void {
    this.callbacks.push(callback);
  }

  route(): fastify.Plugin<Server, IncomingMessage, ServerResponse, never> {
    return async (instance: fastify.FastifyInstance) =>
      instance.post<
        fastify.DefaultQuery,
        fastify.DefaultParams,
        fastify.DefaultHeaders,
        { payload: string }
      >("/slackInteractiveActions", async (request, reply) => {
        for (let callback of this.callbacks) {
          try {
            await callback(
              <SlackInteractiveActionPayload>JSON.parse(request.body.payload),
              reply
            );

            if (reply.sent) {
              logger.info("Handled callback for action", reply, request.body);
              break;
            }
          } catch (err) {
            logger.error(
              "Failed to process callback for action",
              err,
              request.body
            );
          }
          if (!reply.sent) {
            logger.error(
              "Failed to find callback for interaction",
              request.body
            );
          }
          reply.code(200).send();
        }
      });
  }
}

const ActionManagerInstance = new ActionManager();
export { ActionManagerInstance };
