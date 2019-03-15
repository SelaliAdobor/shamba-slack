import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient } from "@slack/client";
import { RequiredField, getRequiredFieldModelForTeam } from "./requiredField";
import { TeamModel } from "../slack/team";
import { RequiredFieldReminder } from "./requiredFieldReminder";
import { logger } from "../server";
const web = new WebClient();

interface SlackSlashCommandRequestBody {
  text: string;
  user_id: string;
  user_name: string;
  team_id: string;
}

export = <fastify.Plugin<Server, IncomingMessage, ServerResponse, never>>(
  async function(instance) {
    instance.post<
      fastify.DefaultQuery,
      fastify.DefaultParams,
      fastify.DefaultHeaders,
      SlackSlashCommandRequestBody
    >("/remindUsers", async function(request, reply) {
      let teamId = request.body.team_id;
      try {
        await new RequiredFieldReminder().remindUsersWithMissingFieldsForTeam(
          teamId
        );
      } catch (err) {
        logger.error("Failed to remind team for fields", teamId, err);
        reply.code(500).send(err);
        return;
      }
      reply.code(200).send("Success");
    });
  }
);
