import { Restroom } from "@restroom-mw/core";
import { ObjectLiteral } from "@restroom-mw/core/src/types";
import * as crypto from 'crypto';

import {
  Gateway, connect, Contract, Identity, Signer, signers,
  Network
}
  from '@hyperledger/fabric-gateway';
import { Client, credentials } from '@grpc/grpc-js';
import { NextFunction, Request, Response } from "express";
import {
  ADDRESS,
  CONNECT,
  CHANNEL,
  CONTRACT,
  QUERY,
  SUBMIT
} from "./actions";
import { UTF8_DECODER, zencodeNamedParamsOf, combineDataKeys } from '@restroom-mw/utils';

let fabricAddress: string = null;
let client: Client = null;
let tlsCertificate;
let input: ObjectLiteral = {};
let gateway: Gateway = null;
let network: Network = null;
let contract: Contract = null;


const evaluateOptions = () => {
  return { deadline: Date.now() + 5000 }; // 5 seconds
}
const endorseOptions = () => {
  return { deadline: Date.now() + 15000 }; // 15 seconds
}
const submitOptions = () => {
  return { deadline: Date.now() + 5000 }; // 5 seconds
}
const commitStatusOptions = () => {
  return { deadline: Date.now() + 60000 }; // 1 minute
}
// The steps in FabricInterop are all required (in this order...)
enum FabricInterop {
  Address = 0,
  Connect,
  Channel,
  Contract
}
let current: FabricInterop = FabricInterop.Address;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NUM_RETRY = 3;
/**
 * @param params list of parameters in the zencode
 *   (length 2*n, 2 parameter for each statement)
 * @param errorMsg string which is shown in case of error
 * @param fn what to do for each
 *
 * Implements retry logic ( see https://stackoverflow.com/a/45347452 )
 */
const submitAndRetry = async (params: string[], errorMsg: string,
  fn: (i: number) => Promise<void>) => {
  for (var i = 0; i < params.length; i += 2) {
    var count = 0;
    var done = false;
    var errCode = 0;
    while (count < NUM_RETRY && !done) {
      try {
        await fn(i);
        done = true;
      } catch (e) {
        errCode = e.code;
        // Wait random time
        await sleep(Math.random() * 10000 + 2000);
      }
      count++;
    }
    if (count == NUM_RETRY) {
      // NUM_RETRY error in the execution, this call failed
      throw new Error(errorMsg + ", code: " + errCode)
    }
  }
}

const validateStep = (requested: FabricInterop) => {
  if (requested > current) {
    throw new Error(
      `One step is missing
1. Set endpoint address
2. Connect organization
3. Set channel
4. Set contract (chaincode)`)
  }
}

export default async (req: Request, res: Response, next: NextFunction) => {
  const rr = new Restroom(req, res);

  try {
    rr.onBefore(async (params) => {
      const { zencode, keys, data } = params;
      input = combineDataKeys(data, keys);
      const namedParamsOf = zencodeNamedParamsOf(zencode, input);

      if (zencode.match(ADDRESS)) {
        validateStep(FabricInterop.Address);
        [fabricAddress, tlsCertificate] = namedParamsOf(ADDRESS);
        tlsCertificate = Buffer.from(tlsCertificate, 'utf-8')
        const tlsCredentials = credentials.createSsl(tlsCertificate);
        client = new Client(fabricAddress, tlsCredentials, {});
        current = FabricInterop.Connect;
      }

      if (zencode.match(CONNECT)) {
        validateStep(FabricInterop.Connect);
        const [mspId, certificate, privateKeyPem] = namedParamsOf(CONNECT);
        // identity
        const certificateBuf = Buffer.from(certificate, 'utf-8');
        const identity: Identity = { mspId: mspId, credentials: certificateBuf };
        // signer
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        const signer: Signer = signers.newPrivateKeySigner(privateKey);

        gateway = connect({
          client,
          identity,
          signer,
          // Default timeouts for different gRPC calls
          evaluateOptions,
          endorseOptions,
          submitOptions,
          commitStatusOptions,
        });
        current = FabricInterop.Channel;
      }

      if (zencode.match(CHANNEL)) {
        validateStep(FabricInterop.Channel);
        const [channelName] = namedParamsOf(CHANNEL)
        network = gateway.getNetwork(channelName);
        current = FabricInterop.Contract;
      }

      if (zencode.match(CONTRACT)) {
        validateStep(FabricInterop.Contract);
        const [contractName] = namedParamsOf(CONTRACT)
        contract = network.getContract(contractName);
      }

      if (zencode.match(QUERY)) {
        validateStep(FabricInterop.Contract); // The user must have set a contract
        const params = zencode.paramsOf(QUERY);
        await submitAndRetry(params, "Could not ealuate transaction",
          async (i: number) => {
            const functionData = input[params[i]]
            const resultBytes = await contract.evaluateTransaction.apply(contract, functionData);
            const resultJson = UTF8_DECODER.decode(resultBytes);
            const result = JSON.parse(resultJson);
            data[params[i + 1]] = result;
          }
        );
      }
    });

    rr.onSuccess(async (params) => {
      validateStep(FabricInterop.Contract); // The user must have set a contract
      const { zencode } = params;
      if (zencode.match(SUBMIT)) {
        const params = zencode.paramsOf(SUBMIT);
        await submitAndRetry(params, "Could not submit transaction",
          async (i: number) => {
            const functionData = input[params[i]]
            await contract.submitTransaction.apply(contract, functionData);
          }
        );
      }
      gateway.close()
    });
    next();
  } catch (e) {
    next(e);
  }
};
