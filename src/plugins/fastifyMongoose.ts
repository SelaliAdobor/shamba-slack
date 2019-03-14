import fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";

import Mongoose from "mongoose";

if (!Mongoose) {
    throw new Error("Could not find Mongoose, was it installed?");
}

declare module "fastify" {
    interface FastifyInstance {
        Mongoose: Mongoose.Mongoose;
        db: Mongoose.Connection;
    }
}
type DetailedOptions = {
    uri: string;
    options: Mongoose.ConnectionOptions;
};

type Options = DetailedOptions | String;

// declare plugin type using fastify.Plugin
const fastifyMongoose: fastify.Plugin<
    Server,
    IncomingMessage,
    ServerResponse,
    Options
> = async function(instance, options, next) {
    let uri = typeof options === "string" ? options : (<DetailedOptions>options).uri;
    let mongoOptions = typeof options === "string" ? {} : (<DetailedOptions>options).options;

    try {
        await Mongoose.connect(uri, mongoOptions);
        instance.decorate("Mongoose", Mongoose).addHook("onClose", function(fastify, done) {
            instance.Mongoose.connection.close(done);
        });

        instance.decorate("db", Mongoose.connection);

        next();
    } catch (err) {
        next(err);
    }
};

export = fastifyMongoose;
