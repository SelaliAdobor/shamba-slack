import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient, WebAPICallResult } from "@slack/client";
import { Team, TeamModel } from "./team";
const web = new WebClient();

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;

if (clientId == null || clientSecret == null) {
  throw new Error("Slack Client ID and Secret not configured.");
}

interface SlackOAuthRequestQuery {
  code: string;
}

async function updateOrCreateTeamToken(team: Team) {
  let matchingTeam = await TeamModel.findOne({ teamId: team.teamId });

  let isNewTeam = matchingTeam == null;

  const authedTeam = isNewTeam ? new TeamModel(team) : matchingTeam!.set(team);

  await authedTeam.save();
  return isNewTeam;
}

export = <fastify.Plugin<Server, IncomingMessage, ServerResponse, never>>(
  async function(instance) {
    instance.get<
      SlackOAuthRequestQuery,
      fastify.DefaultParams,
      fastify.DefaultHeaders,
      fastify.DefaultBody
    >("/slackOauthCallback", async function(request, reply) {
      let code = request.query.code;

      let oauthResult = <any>await web.oauth.access({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      });

      if (!oauthResult.ok) {
        throw new Error(oauthResult.error);
      }
      const teamId = oauthResult["team_id"];

      let team: Team = new Team({
        teamId: teamId,
        teamName: oauthResult["team_name"],
        userId: oauthResult["user_id"],
        accessToken: oauthResult["access_token"],
        botAccessToken: oauthResult["bot"]["bot_access_token"],
        botUserId: oauthResult["bot"]["bot_user_id"]
      });
      let isNewTeam = await updateOrCreateTeamToken(team);
      request.log.info(
        `Retrived OAuth token for team. Name: ${
          team.teamName
        }, Is New Team?: ${isNewTeam}`
      );
      reply.code(200).send({
        ok: true,
        isNewTeam
      });
    });
  }
);
