"use client";

import Link from "next/link";
import type { NextPage } from "next";
import {useAccount, useWalletClient} from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import * as ed from '@noble/ed25519';
import {
  ID_GATEWAY_ADDRESS,
  ID_REGISTRY_ADDRESS,
  ViemLocalEip712Signer,
  idGatewayABI,
  idRegistryABI,
  NobleEd25519Signer,
  BUNDLER_ADDRESS,
  bundlerABI,
  KEY_GATEWAY_ADDRESS,
  keyGatewayABI,
  verifyRegister, ViemWalletEip712Signer,
} from '@farcaster/hub-web';
import { bytesToHex, hexToBytes, createPublicClient, createWalletClient, http, PrivateKeyAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {hardhat, optimism} from 'viem/chains';
import {ethers} from "ethers";
import axios from 'axios';

const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // set the signatures' deadline to 1 hour from now

const WARPCAST_RECOVERY_PROXY = '0x00000000FcB080a4D6c39a9354dA9EB9bC104cd7';



const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  const wagmiWC = useWalletClient();

  /** LOCAL CHAIN **/

//   const publicClient = createPublicClient({
//     chain: optimism,
//     transport: http('http://localhost:8545'),
//   });
//
//   const walletClient = createWalletClient({
//     chain: optimism,
//     transport: http('http://localhost:8545'),
//   });
//
//   const APP_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
//   const ALICE_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
//
//
//   const app = privateKeyToAccount(APP_PRIVATE_KEY);
//   const appAccountKey = new ViemLocalEip712Signer(app as any);
//
//
//   const alice = privateKeyToAccount(ALICE_PRIVATE_KEY);
//   /** Use ViemWalletEip712Signer instead of ViemLocalEip712Signer to sign with metamask **/
//   const aliceAccountKey = new ViemLocalEip712Signer(alice as any);
// //   const aliceAccountKey = new ViemWalletEip712Signer(wagmiWC.data as any);


  /** ON CHAIN **/

  const publicClient = createPublicClient({
    chain: optimism,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: optimism,
    transport: http(),
  });


  const test = ethers.Wallet.fromPhrase(process.env.NEXT_PUBLIC_RECOVERY_PHRASE!);
  const app = privateKeyToAccount(test.privateKey as `0x${string}`);
  const appAccountKey = new ViemLocalEip712Signer(app as any);

  const test2 = ethers.Wallet.createRandom().mnemonic;
  const alicePK = ethers.Wallet.fromPhrase(test2!.phrase).privateKey;
  const alicef = privateKeyToAccount(alicePK as `0x${string}`);

  // console.log(test2!.phrase, alicePK, alicef.address);
  const alice = privateKeyToAccount(alicePK as `0x${string}`);
  const aliceAccountKey = new ViemLocalEip712Signer(alice as any);


  const registerApp = async () => {
    /*******************************************************************************
     * IdGateway - register - Register an app FID.
     *******************************************************************************/

    /**
     *  Get the current price to register. We're not going to register any
     *  extra storage, so we pass 0n as the only argument.
     */
    const price = await publicClient.readContract({
      address: ID_GATEWAY_ADDRESS,
      abi: idGatewayABI,
      functionName: 'price',
      args: [0n],
    });

    /**
     *  Call `register` to register an FID to the app account.
     */
    const { request } = await publicClient.simulateContract({
      account: app,
      address: ID_GATEWAY_ADDRESS,
      abi: idGatewayABI,
      functionName: 'register',
      args: [WARPCAST_RECOVERY_PROXY, 0n],
      value: price,
    });
    await walletClient.writeContract(request);

    /**
     *  Read the app fid from the Id Registry contract.
     */
    const APP_FID = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [app.address],
    });

    console.log('APP FID:', APP_FID);
  }

  const register = async () => {
    /**
     *  Read the app fid from the Id Registry contract.
     */
    const APP_FID = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [app.address],
    });
    console.log('APP FID:', APP_FID);
    /*******************************************************************************
     * Collect Register signature from Alice
     *******************************************************************************/

    let nonce = await publicClient.readContract({
      address: KEY_GATEWAY_ADDRESS,
      abi: keyGatewayABI,
      functionName: 'nonces',
      args: [alice.address],
    });

    const registerSignatureResult = await aliceAccountKey.signRegister({
      to: alice.address as `0x${string}`,
      recovery: WARPCAST_RECOVERY_PROXY,
      nonce,
      deadline,
    });

    let registerSignature;
    if (registerSignatureResult.isOk()) {
      registerSignature = registerSignatureResult.value;

      const valid = await verifyRegister({
        to: alice.address as `0x${string}`,
        recovery: WARPCAST_RECOVERY_PROXY,
        nonce,
        deadline,
      }, registerSignature, hexToBytes(alice.address as `0x${string}`));
    } else {
      throw new Error('Failed to generate register signature');
    }

    /*******************************************************************************
     * Collect Add signature from alice.
     *******************************************************************************/

    /**
     *  1. Create an Ed25519 account keypair for Alice and get the public key.
     */
    const privateKeyBytes = ed.utils.randomPrivateKey();
    const accountKey = new NobleEd25519Signer(privateKeyBytes);

    let accountPubKey = new Uint8Array();
    const accountKeyResult = await accountKey.getSignerKey();
    if (accountKeyResult.isOk()) {
      accountPubKey = accountKeyResult.value;

      /**
       *  2. Generate a Signed Key Request from the app account.
       */
      const signedKeyRequestMetadata =
          await appAccountKey.getSignedKeyRequestMetadata({
            requestFid: APP_FID,
            key: accountPubKey,
            deadline,
          });

      if (signedKeyRequestMetadata.isOk()) {
        const metadata = bytesToHex(signedKeyRequestMetadata.value);
        /**
         *  3. Read Alice's nonce from the Key Gateway.
         */
        nonce = await publicClient.readContract({
          address: KEY_GATEWAY_ADDRESS,
          abi: keyGatewayABI,
          functionName: 'nonces',
          args: [alice.address],
        });

        /**
         *  Then, collect her `Add` signature.
         */
        const addSignatureResult = await aliceAccountKey.signAdd({
          owner: alice.address as `0x${string}`,
          keyType: 1,
          key: accountPubKey,
          metadataType: 1,
          metadata,
          nonce,
          deadline,
        });

        if (addSignatureResult.isOk()) {
          const addSignature = addSignatureResult.value;
          /**
           *  Read the current registration price.
           */
          const price = await publicClient.readContract({
            address: BUNDLER_ADDRESS,
            abi: bundlerABI,
            functionName: 'price',
            args: [0n],
          });

          /**
           *  Call `register` with Alice's signatures, registration, and key parameters.
           */
          const { request } = await publicClient.simulateContract({
            account: app,
            address: BUNDLER_ADDRESS,
            abi: bundlerABI,
            functionName: 'register',
            args: [
              {
                to: alice.address,
                recovery: WARPCAST_RECOVERY_PROXY,
                sig: bytesToHex(registerSignature),
                deadline,
              },
              [
                {
                  keyType: 1,
                  key: bytesToHex(accountPubKey),
                  metadataType: 1,
                  metadata: metadata,
                  sig: bytesToHex(addSignature),
                  deadline,
                },
              ],
              0n,
            ],
            value: price,
          });
          await walletClient.writeContract(request);
          const MY_FID = await publicClient.readContract({
            address: ID_REGISTRY_ADDRESS,
            abi: idRegistryABI,
            functionName: 'idOf',
            args: [alice.address],
          });
          console.log('USER ID:', MY_FID);
        }
      }
    }
  }

  const transfer = async (from: PrivateKeyAccount, to: PrivateKeyAccount) => {
    const FROM_FID = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [from.address],
    });
    const TO_FID = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [to.address],
    });

    console.log('FROM FID:', FROM_FID);
    console.log('TO FID:', TO_FID);

    const nonce = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'nonces',
      args: [to.address],
    });

    const now = Math.floor(Date.now() / 1000);
    const oneHour = 60 * 60;
    const deadline = BigInt(now + oneHour);

    const toAccountKey = new ViemLocalEip712Signer(to as any);

    const signature = await toAccountKey.signTransfer({
      fid: FROM_FID,
      to: to.address as `0x${string}`,
      nonce,
      deadline,
    });
    if (signature.isOk()) {
      const transferSignature = signature.value;
      const { request } = await publicClient.simulateContract({
        account: from,
        address: ID_REGISTRY_ADDRESS,
        abi: idRegistryABI,
        functionName: 'transfer',
        args: [to.address, deadline, bytesToHex(transferSignature)],
      });
      await walletClient.writeContract(request);

      const FROM_FID = await publicClient.readContract({
        address: ID_REGISTRY_ADDRESS,
        abi: idRegistryABI,
        functionName: 'idOf',
        args: [from.address],
      });
      const TO_FID = await publicClient.readContract({
        address: ID_REGISTRY_ADDRESS,
        abi: idRegistryABI,
        functionName: 'idOf',
        args: [to.address],
      });
      console.log('------------ AFTER TRANSFER ------------');
      console.log('FROM FID:', FROM_FID);
      console.log('TO FID:', TO_FID);
    }
  }

  const castWithAppAccount = async (e: any) => {
    e.preventDefault();
    const FID = await publicClient.readContract({
      address: ID_REGISTRY_ADDRESS,
      abi: idRegistryABI,
      functionName: 'idOf',
      args: [app.address],
    });
    if (e.target.castText.value) {
      const res = await axios.post('http://localhost:3001/cast', {
        text: e.target.castText.value,
        pk: process.env.NEXT_PUBLIC_SIGNING_KEY!,
        fid: Number(FID),
      })
      console.log(res);
    }
  }

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">Scaffold-ETH 2</span>
          </h1>
          <div className="flex justify-center items-center space-x-2">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>
          <button onClick={registerApp}> REGISTER APP </button>
          <br />
          <button onClick={register}> REGISTER USER </button>
          <br />
          <button onClick={() => transfer(app, alice)}> TRANSFER </button>
          <br />
          <form onSubmit={castWithAppAccount}>
            <input name="castText"/>
            <button type="submit"> CAST </button>
          </form>
          {/*<p className="text-center text-lg">*/}
          {/*  Get started by editing{" "}*/}
          {/*  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">*/}
          {/*    packages/nextjs/app/page.tsx*/}
          {/*  </code>*/}
          {/*</p>*/}
          {/*<p className="text-center text-lg">*/}
          {/*  Edit your smart contract{" "}*/}
          {/*  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">*/}
          {/*    YourContract.sol*/}
          {/*  </code>{" "}*/}
          {/*  in{" "}*/}
          {/*  <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">*/}
          {/*    packages/hardhat/contracts*/}
          {/*  </code>*/}
          {/*</p>*/}
        </div>

        <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
