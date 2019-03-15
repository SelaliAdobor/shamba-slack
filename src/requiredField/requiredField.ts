import { prop, Typegoose, ModelType, InstanceType } from "typegoose";

export class RequiredField extends Typegoose {
  @prop({ required: true })
  fieldName!: string;
  @prop({ required: false })
  rationale?: string | null;

  static create(args: { fieldName: string; rationale?: string | null }) {
    let field = new RequiredField();

    field.fieldName = args.fieldName;
    field.rationale = args.rationale;
    return field;
  }
}

export function getRequiredFieldModelForTeam(teamId: string) {
  return new RequiredField().getModelForClass(RequiredField, {
    schemaOptions: { timestamps: true, collection: `required-fields-${teamId}` }
  });
}
