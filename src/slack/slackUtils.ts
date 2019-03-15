import { WebClient, WebAPICallResult } from "@slack/client";
import { initAsArray } from "typegoose/lib/utils";
const slack = new WebClient();

export interface SlackInteractiveActionPayload {
  type: string;
  actions: SlackInteractiveActionPayloadAction[];
  callback_id: string;
  team: SlackInteractiveActionPayloadTeam;
  channel: SlackInteractiveActionPayloadChannel;
  user: SlackInteractiveActionPayloadChannel;
  action_ts: string;
  message_ts: string;
  attachment_id: string;
  token: string;
  original_message: SlackInteractiveActionPayloadOriginalmessage;
  response_url: string;
  trigger_id: string;
}

export interface SlackInteractiveActionPayloadOriginalmessage {
  text: string;
  attachments: SlackInteractiveActionPayloadAttachment[];
}

export interface SlackInteractiveActionPayloadAttachment {
  title: string;
  fields?: SlackInteractiveActionPayloadField[];
  author_name?: string;
  author_icon?: string;
  image_url?: string;
  text?: string;
  fallback?: string;
  callback_id?: string;
  color?: string;
  attachment_type?: string;
  actions?: SlackInteractiveActionPayloadOriginalMessageAction[];
}

export interface SlackInteractiveActionPayloadOriginalMessageAction {
  name: string;
  text: string;
  type: string;
  value: string;
}

export interface SlackInteractiveActionPayloadField {
  title: string;
  value: string;
  short: boolean;
}

export interface SlackInteractiveActionPayloadChannel {
  id: string;
  name: string;
}

export interface SlackInteractiveActionPayloadTeam {
  id: string;
  domain: string;
}

export interface SlackInteractiveActionPayloadAction {
  block_id: any;
  name: string;
  value: string;
  type: string;
}

export interface SlackUsersListProfile {
  avatar_hash: string;
  status_text: string;
  status_emoji: string;
  real_name: string;
  display_name: string;
  real_name_normalized: string;
  display_name_normalized: string;
  email: string;
  image_24: string;
  image_32: string;
  image_48: string;
  image_72: string;
  image_192: string;
  image_512: string;
  team: string;
  image_1024: string;
  image_original: string;
  first_name: string;
  last_name: string;
  title: string;
  phone: string;
  skype: string;
}

export interface SlackUsersListMember {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  profile: SlackUsersListProfile;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  updated: number;
  is_app_user: boolean;
  has_2fa: boolean;
}

export interface SlackUsersListResponse extends WebAPICallResult {
  members: SlackUsersListMember[];
}

export interface SlackTeamProfileField {
  id: string;
  ordering: number;
  label: string;
  hint: string;
  type: string;
  possible_values?: String[];
  options?: any;
  is_hidden: number;
}

export interface SlackTeamProfile {
  fields: SlackTeamProfileField[];
}

export interface SlackGetTeamProfileResponse extends WebAPICallResult {
  profile: SlackTeamProfile;
}
export interface SlackUsersProfileGetResponse extends WebAPICallResult {
  profile: SlackUsersProfile;
}
export interface SlackUsersProfileFields {
  [fieldId: string]: {
    value: string;
    alt: string;
  };
}
export interface SlackUsersProfile {
  avatar_hash: string;
  status_text: string;
  status_emoji: string;
  status_expiration: number;
  real_name: string;
  display_name: string;
  real_name_normalized: string;
  display_name_normalized: string;
  email: string;
  fields: SlackUsersProfileFields | undefined;
  image_original: string;
  image_24: string;
  image_32: string;
  image_48: string;
  image_72: string;
  image_192: string;
  image_512: string;
  team: string;
}
export interface CompleteSlackUser {
  user: SlackUsersListMember;
  profile: SlackUsersProfile;
}
async function getTeamCustomProfileFields(
  token: string
): Promise<SlackTeamProfileField[]> {
  let teamProfile = <SlackGetTeamProfileResponse>await slack.team.profile.get({
    token: token
  });

  if (!teamProfile.ok) {
    throw new Error(`Failed to load profile for team.` + teamProfile.error);
  }

  return teamProfile.profile.fields;
}
async function getAllUsersFromTeam(
  token: string,
  includeBots: boolean = false
): Promise<SlackUsersListMember[]> {
  let initialList: SlackUsersListResponse = <SlackUsersListResponse>(
    await slack.users.list({
      token: token
    })
  );

  if (!initialList.ok) {
    throw new Error("Failed to get list for team: " + initialList.error);
  }
  let users = initialList.members;

  if (
    initialList.response_metadata != undefined &&
    initialList.response_metadata.next_cursor != undefined
  ) {
    let cursor: string | undefined = initialList.response_metadata.next_cursor;
    //Because Slack returns an empty string instead of undefined...
    while (cursor != undefined && cursor.trim().length > 0) {
      let nextUserList = <SlackUsersListResponse>await slack.users.list({
        token: token,
        cursor: cursor
      });
      let additionalUsers = nextUserList.members;
      if (!nextUserList.ok) {
        throw new Error("Failed to get list for team: " + nextUserList.error);
      }
      if (additionalUsers != undefined) {
        users.concat(additionalUsers);
      }
      let metadata = nextUserList.response_metadata;
      cursor = metadata != undefined ? metadata.next_cursor : undefined;
    }
  }
  users = users.filter(user => user.name.toLowerCase().includes("selali"));
  return includeBots
    ? users
    : users.filter(user => !(user.is_bot || user.id == "USLACKBOT"));
}

async function getUserProfile(userId: string, token: string) {
  let profileResponse = <SlackUsersProfileGetResponse>(
    await slack.users.profile.get({
      token: token,
      user: userId,
      include_labels: false
    })
  );
  if (!profileResponse.ok) {
    throw new Error("Failed to get profile for user:" + profileResponse.error);
  }
  return profileResponse.profile;
}

export { getAllUsersFromTeam, getTeamCustomProfileFields, getUserProfile };
