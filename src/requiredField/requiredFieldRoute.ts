import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient } from "@slack/client";
import { RequiredField, RequiredFieldModel } from "./requiredField";
import { TeamModel } from "../slack/team";
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
    >("/addRequiredField", async function(request, reply) {
      let fieldName = request.body.text;
      let teamId = request.body.team_id;
      let matchingTeam = await TeamModel.findOne({
        teamId: teamId
      });
      if (matchingTeam == null) {
        request.log.error(
          `Failed to find Oauth token for team. Team: ${teamId}`
        );
        reply
          .code(500)
          .send(
            "Your team's authentication is invalid, please reinstall the app"
          );
        return;
      }
      let teamProfile = <any>await web.team.profile.get({
        token: matchingTeam.accessToken
      });

      if (!teamProfile.ok) {
        request.log.error(
          `Failed to load profile for team. Team: ${teamId}`,
          teamProfile.error
        );
        throw new Error(teamProfile.error);
      }

      const fields: Array<any> = teamProfile["profile"]["fields"];

      let field = fields.find(field => field["label"] == fieldName);

      if (field == null) {
        reply
          .code(200)
          .send("🤔I couldn't find that field in your team's profile");
        request.log.info(
          `Could not find field in Slack: ${teamId}, Field Name: ${fieldName}`
        );
      }

      let existingRequiredField = await RequiredFieldModel.findOne({
        fieldName: fieldName
      });

      if (existingRequiredField != null) {
        reply.code(200).send("You already made that field required 🙂");
        request.log.info(
          `Required field already existed. Team: ${teamId}, Field Name: ${fieldName}`
        );
      }

      let requiredField: RequiredField = new RequiredField({
        fieldName: field["label"]
      });

      new RequiredFieldModel(requiredField)
        .getModelForClass(RequiredField, {
          schemaOptions: {
            collection: `required-fields-${teamId}`
          }
        })
        .save();
      request.log.info(
        `Created required field. Team: ${teamId}, Field Name: ${fieldName}`
      );

      reply
        .code(200)
        .send(
          `The Slack profile field "${fieldName}" is now marked as required 🎉`
        );
    });
  }
);
