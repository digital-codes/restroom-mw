import * as redis from "redis";
import { Restroom } from "@restroom-mw/core";
import { NextFunction, Request, Response } from "express";
import { zencodeNamedParamsOf } from "@restroom-mw/utils";

/**
 *
 * @enum {string}
 */
enum Action {
  /**
   * Given I have a redis connection on {}
   * @param {string} connection url
   */
  CONNECT = "have a redis connection on {}",
  /**
   * Given I write data into redis under the key {}
   * @param {string} key
   */
  SET = "write data into redis under the key {}",
  /**
   * Given I read from redis the data under the key {} and save the output into {}
   * @param {string} key
   * @param {string} output
   */
  GET = `read from redis the data under the key {} and save the output into {}`,
  /**
   * Given I write data into redis under the key named {}
   * @param {string} key
   */
  SET_NAMED = "write data into redis under the key named {}",
  /**
   * Given I read from redis the data under the key named {} and save the output into {}
   * @param {string} key
   * @param {string} output
   */
  GET_NAMED = `read from redis the data under the key named {} and save the output into {}`,
  /**
   * Given I read from redis the data under the key named {} and save the output into {}
   * @param {string} key
   * @param {string} output
   */
  GET_KEYS_CONTAIN = "read from redis the data under the keys containing {} and save the output into {}",
}

const REDIS_LUA_FILTER_KEY_AND_GET = "local keys = redis.call('KEYS', '*'..KEYS[1]..'*'); return redis.call('MGET', unpack(keys))"
export default (req: Request, res: Response, next: NextFunction) => {
  const rr = new Restroom(req, res);
  let client: any = null;
  let getRedisClient: () => any;
  let namedSet: string = null;

  rr.onBefore(async (params: any) => {
    const { zencode, data, keys } = params;
    const content = rr.combineDataKeys(data, keys);
    const namedParamsOf = zencodeNamedParamsOf(zencode, content);

    if (zencode.match(Action.CONNECT)) {
      const [url] = zencode.paramsOf(Action.CONNECT);
      getRedisClient = (() => {
        const getRedisClientFromUrl = async () => {
          if (client === null) {
            client = redis.createClient(url);
            await client.connect();
          }
          return client;
        };
        return getRedisClientFromUrl;
      })();
    }

    const getFromRedis = async (action: string) => {
      client = client || (await getRedisClient());
      const [key, outputVariable] = namedParamsOf(action);
      console.log(key, outputVariable);
      await client.sendCommand(["SETNX", key, "{}"]);
      data[outputVariable] = JSON.parse((await client.get(key)) ?? {});
    };

    if (zencode.match(Action.GET)) await getFromRedis(Action.GET);
    if (zencode.match(Action.GET_NAMED)) await getFromRedis(Action.GET_NAMED);
    if (zencode.match(Action.SET_NAMED)) {
      const [outputVariable] = namedParamsOf(Action.SET_NAMED);
      namedSet = outputVariable;
    }
    if (zencode.match(Action.GET_KEYS_CONTAIN)) {
      client = client || (await getRedisClient());
      const [contained, result] = namedParamsOf(Action.GET_KEYS_CONTAIN);
      const dataFromRedis = await client.sendCommand(
        ["EVAL", REDIS_LUA_FILTER_KEY_AND_GET, "1", contained]);
      data[result] = dataFromRedis
    }
  });

  rr.onSuccess(async (args: { result: any; zencode: any }) => {
    const { result, zencode } = args;

    if (zencode.match(Action.SET)) {
      client = client || (await getRedisClient());
      const [key] = zencode.paramsOf(Action.SET);
      await client.set(key, JSON.stringify(result));
    }

    if (zencode.match(Action.SET_NAMED)) {
      client = client || (await getRedisClient());
      await client.set(namedSet, JSON.stringify(result));
    }
  });

  next();
};
