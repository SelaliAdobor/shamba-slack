import { prop, Typegoose, ModelType, InstanceType } from "typegoose";

export class Team extends Typegoose {
    @prop({ required: true })
    teamId: string;
    @prop({ required: true })
    teamName: string;
    @prop({ required: true })
    userId: string;
    @prop({ required: true })
    accessToken: string;
    constructor({});
    constructor(args: { teamId: string; teamName: string; userId: string; accessToken: string }) {
        super();

        this.teamId = args.teamId;
        this.teamName = args.teamName;
        this.userId = args.userId;
        this.accessToken = args.accessToken;
    }
}

export const TeamModel = new Team({}).getModelForClass(Team, {
    schemaOptions: { timestamps: true },
});
