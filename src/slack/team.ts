import { prop, Typegoose, ModelType, InstanceType } from "typegoose";

export class Team extends Typegoose {
  @prop({ required: true })
  teamId: string;
  @prop({ required: true })
  teamName: string;
  @prop({ required: true })
  userId: string;
  @prop({ required: true })
  userAccessToken: string;
  @prop({ required: true })
  botAccessToken: string;
  @prop({ required: true })
  botUserId: string;

  constructor({});

  constructor(args: {
    teamId: string;
    teamName: string;
    userId: string;
    accessToken: string;
    botAccessToken: string;
    botUserId: string;
  }) {
    super();

    this.teamId = args.teamId;
    this.teamName = args.teamName;
    this.userId = args.userId;
    this.userAccessToken = args.accessToken;
    this.botAccessToken = args.botAccessToken;
    this.botUserId = args.botUserId;
  }
}

export const TeamModel = new Team({}).getModelForClass(Team, {
  schemaOptions: { timestamps: true }
});
