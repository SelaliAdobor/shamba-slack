import fastify from "fastify";
import mongoose from "mongoose";
import fastifyMongoose from "./plugins/fastifyMongoose";
import Redis from "ioredis";
import { ActionManagerInstance } from "./slack/actions/actionManager";

require("dotenv").config();

const monogoUri = process.env.MONGODB_URI;
if (monogoUri == null) {
  throw new Error("MONGODB_URI not set");
}
(<any>mongoose).Promise = global.Promise;
const redis = new Redis(process.env.REDIS_URL);
const port = Number(process.env.PORT) || 1234;

const server = fastify({
  logger: {
    level: "trace"
  }
});

server.register(require("fastify-formbody"));
server.register(fastifyMongoose, monogoUri);

server.register(require("./slack/authRoute"));
server.register(require("./requiredField/requiredFieldRoute"));
server.register(require("./requiredField/sendReminderRoute"));

server.register(ActionManagerInstance.route());
server.get("/", async () => {
  return "Hello World!";
});

const start = async () => {
  try {
    await server.listen(port, "0.0.0.0");

    server.log.info(server.printRoutes());

    let address = server.server.address();

    server.log.info(`Listening on ${JSON.stringify(address)}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
let logger = server.log;
export { logger, redis };
