import { WebClient, LogLevel } from "@slack/client";
import { getRequiredFieldModelForTeam } from "./requiredField";
import { TeamModel } from "../slack/team";
import {
  getAllUsersFromTeam,
  getTeamCustomProfileFields,
  SlackTeamProfileField,
  SlackInteractiveActionPayload,
  getUserProfile,
  SlackUsersListMember,
  SlackUsersProfile
} from "../slack/slackUtils";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { logger } from "../server";
import * as rp from "request-promise";

const slack = new WebClient(undefined, { logLevel: LogLevel.DEBUG });

type MissingFieldsButtonContext = {
  userToken: string;
  botToken: string;
  user: SlackUsersListMember;
  profile: SlackUsersProfile;
  missingFields: SlackTeamProfileField[];
};
type MissingFieldsDialogContext = {
  userToken: string;
  botToken: string;
  user: SlackUsersListMember;
  profile: SlackUsersProfile;
  missingFields: SlackTeamProfileField[];
};
export class RequiredFieldReminder {
  reminderButtonInteractionType = "fill-out-missing-fields";
  missingFieldDialogInteractionType = "missing-fields-dialog";

  constructor() {
    ActionManagerInstance.listenForSlackInteractions(async (payload, reply) => {
      if (payload.actions != undefined) {
        let blockId = payload.actions[0].block_id;
        if (blockId.startsWith(this.reminderButtonInteractionType)) {
          await this.handleUserReminderButtonResponse(payload);
        }
        await reply.code(200).send();
        return;
      }

      let callbackId = payload.callback_id;
      if (
        callbackId != undefined &&
        callbackId.startsWith(this.missingFieldDialogInteractionType)
      ) {
        await this.handleUserDialogResponse(payload);
        await reply.code(200).send();
        return;
      }
    });
  }

  async remindUsersWithMissingFieldsForTeam(teamId: String) {
    let team = await TeamModel.findOne({ teamId: teamId });
    if (team == undefined) {
      throw new Error("Could not find team to remind");
    }

    let RequiredFieldModel = getRequiredFieldModelForTeam(team.teamId);
    let requiredFields = await RequiredFieldModel.find();

    let slackFields = await getTeamCustomProfileFields(team.userAccessToken);

    let users = await getAllUsersFromTeam(team.userAccessToken);

    await Promise.all(
      users.map(async user => {
        let profile = await getUserProfile(user.id, team!.userAccessToken);
        let requiredSlackFields = slackFields.filter(slackField =>
          requiredFields.some(
            requiredField => requiredField.fieldName == slackField.label
          )
        );

        //If no fields have been set by the user, fields will be null, so send a reminder for all required fields
        if (profile.fields == null) {
          await this.sendUserReminderForMissingFields(
            user,
            profile,
            team!.userAccessToken,
            team!.botAccessToken,
            requiredSlackFields
          );
          return;
        }

        let userProfileEmptyRequiredFields = <SlackTeamProfileField[]>(
          Object.entries(profile.fields)
            .filter(([fieldId, field]) => {
              return field.value == undefined || field.value.trim().length < 1;
            })
            .map(([fieldId, field]) =>
              requiredSlackFields.find(slackField => slackField.id == fieldId)
            )
            .filter(requiredField => requiredField != undefined)
        );

        //When a field is not set it will be missing from the Profile Fields response
        let missingFields = requiredSlackFields.filter(slackField => {
          return !Object.keys(profile.fields!).some(
            (fieldId: string) => fieldId == slackField.id
          );
        });

        userProfileEmptyRequiredFields = userProfileEmptyRequiredFields.concat(
          missingFields
        );

        console.log(
          "Missing fields",
          missingFields,
          "Profile fields",
          profile.fields,
          "Required fields",
          requiredSlackFields,
          "User profile",
          userProfileEmptyRequiredFields
        );
        this.sendUserReminderForMissingFields(
          user,
          profile,
          team!.userAccessToken,
          team!.botAccessToken,
          userProfileEmptyRequiredFields
        );
      })
    );
  }

  private async sendUserReminderForMissingFields(
    user: SlackUsersListMember,
    profile: SlackUsersProfile,
    userToken: string,
    botToken: string,
    missingFields: SlackTeamProfileField[]
  ) {
    if (missingFields.length < 1) {
      return; //No need to remind if there's no missing fields
    }

    let conversation = await slack.im.open({
      token: botToken,
      user: user.id
    });

    if (!conversation.ok) {
      throw new Error(
        `Unable to open conversation with ${user.name}, ${conversation.error}`
      );
    }

    let conversationChannelId = (<any>conversation)["channel"]["id"];
    let callbackId = await ActionManagerInstance.setInteractionContext<
      MissingFieldsButtonContext
    >(this.reminderButtonInteractionType, {
      userToken,
      botToken,
      user,
      profile,
      missingFields
    });

    let message = await slack.chat.postMessage({
      token: botToken,
      channel: conversationChannelId,
      text: `Your profile's incomplete! 😱`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "Your Slack profile is incomplete! 😱 \n But don't worry, I can help you fill out the missing data, just click that button 👉"
          },
          block_id: callbackId,
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Fill out missing info",
              emoji: true
            },
            value: callbackId
          }
        }
      ]
    });

    if (!message.ok) {
      throw new Error("Message error: " + message.error);
    }
  }
  private getBlockForMissingField(field: SlackTeamProfileField) {
    return field.possible_values == null
      ? {
          type: "text",
          label: field.label,
          name: field.label
        }
      : {
          label: field.label,
          type: "select",
          name: field.label,
          options: field.possible_values.map(possibleValue => {
            return {
              label: possibleValue,
              value: possibleValue
            };
          })
        };
  }

  private async handleUserReminderButtonResponse(
    payload: SlackInteractiveActionPayload
  ) {
    let context = await ActionManagerInstance.getInteractionContext<
      MissingFieldsButtonContext
    >(payload.actions[0].block_id);

    if (context == null) {
      throw Error("Interaction expired.");
    }

    let elements: Array<any> = context.missingFields.map(
      this.getBlockForMissingField
    );

    let callbackId = await ActionManagerInstance.setInteractionContext<
      MissingFieldsDialogContext
    >(this.missingFieldDialogInteractionType, {
      user: context.user,
      userToken: context.userToken,
      botToken: context.botToken,
      missingFields: context.missingFields,
      profile: context.profile
    });
    let dialog = await slack.dialog.open({
      token: context.botToken,
      trigger_id: payload.trigger_id,
      dialog: {
        title: "Complete your profile!",
        callback_id: callbackId,
        notify_on_cancel: true,
        elements: elements
      }
    });
    if (!dialog.ok) {
      throw new Error("Dialog error: " + dialog.error);
    }
  }
  private async handleUserDialogResponse(
    payload: SlackInteractiveActionPayload
  ) {
    let context = await ActionManagerInstance.getInteractionContext<
      MissingFieldsDialogContext
    >(payload.callback_id);
    if (context == null) {
      throw Error("Interaction expired.");
    }

    let answers = Object.entries(<{ [name: string]: string }>(
      (<any>payload)["submission"]
    ));

    let fields: any = {};
    let easterEggText = "";
    context.missingFields.forEach(missingField => {
      let matchingAnswer = answers.find(
        ([name, answer]) => name == missingField.label
      );
      if (matchingAnswer == undefined) {
        logger.error(
          "Failed to find matching answer for dialog question",
          missingField
        );
        return undefined;
      }
      fields[missingField.id] = {
        value: matchingAnswer[1]
      };
      if (missingField.label == "Is Croc?" && matchingAnswer[1] == "true") {
        easterEggText = "...🐊 Croc' On!🤙🏾  🐊";
      }
    });

    let profileSet = await slack.users.profile.set({
      profile: JSON.stringify({
        fields: fields
      }),
      token: context.userToken
    });

    if (!profileSet.ok) {
      throw new Error("Failed to set user profile: " + profileSet.error);
    }

    await rp.post(payload.response_url, {
      json: true,
      body: {
        text: `Updated your profile! 🎉` + easterEggText
      }
    });
  }
}
