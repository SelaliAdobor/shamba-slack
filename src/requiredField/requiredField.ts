import { prop, Typegoose, ModelType, InstanceType } from "typegoose";

export class RequiredField extends Typegoose {
  @prop({ required: true })
  fieldName: string;
  @prop({ required: false })
  rationale: string | null;
  constructor({});
  constructor(args: { fieldName: string; rationale: string | null }) {
    super();

    this.fieldName = args.fieldName;
    this.rationale = args.rationale;
  }
}

export const RequiredFieldModel = new RequiredField({}).getModelForClass(
  RequiredField,
  {
    schemaOptions: { timestamps: true }
  }
);
