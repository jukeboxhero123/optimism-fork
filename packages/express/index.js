const express = require('express')
const app = express()
const port = 3001
const cors = require('cors')
const {hexToBytes} = require('viem')
const  {
    FarcasterNetwork,
    getInsecureHubRpcClient, makeCastAdd, NobleEd25519Signer, makeReactionAdd, makeLinkAdd, getCastsByFid
} = require("@farcaster/hub-nodejs")

const HUB_URL = "localhost:2283"; // URL + Port of the Hub
const HUB_URL_2 = "localhost:2285"; // URL + Port of the Hub

const client = getInsecureHubRpcClient(HUB_URL);
const client2 = getInsecureHubRpcClient(HUB_URL_2);
const FC_NETWORK = FarcasterNetwork.DEVNET;

app.use(cors())
app.use(express.json())    // <==== parse request body as JSON

app.get('/:hub/:fid', async (req, res) => {
    const FID = Number(req.params.fid); // Your fid
    const hubId = Number(req.params.hub);
    const hub = (hubId === 1 ? client : client2);
    const castsResult = await hub.getCastsByFid({ fid: FID })
    if (castsResult.isOk()) {
        await Promise.all(castsResult.value.messages.map(async (m, i) => {
            const reactions = await client.getReactionsByCast({
                targetCastId: {
                    /** Fid of the user who created the cast */
                    fid: m.data.fid,
                    /** Hash of the cast */
                    hash: m.hash,
                }
            });
            if (reactions.isOk()) {
                castsResult.value.messages[i].reactions = reactions.value.messages;
            }
        }));

        res.json(castsResult);
    } else {
        res.status(500);
    }
})

const submitMessage = async (resultPromise, hub) => {
    const result = await resultPromise;
    if (result.isErr()) {
        throw new Error(`Error creating message: ${result.error}`);
    }
    return await (hub === 1 ? client : client2).submitMessage(result.value);
};
app.post('/cast', async (req, res) => {
    const FID = req.body.fid; // Your fid
    const ed25519Signer = new NobleEd25519Signer(hexToBytes(req.body.pk));
    const dataOptions = {
        fid: FID,
        network: FC_NETWORK,
    };

    const hub = req.body.hub;

    const cast = await submitMessage(makeCastAdd(
        {
            text: req.body.text, // Text can be up to 320 bytes long
            embeds: [],
            embedsDeprecated: [],
            mentions: [],
            mentionsPositions: [],
        },
        dataOptions,
        ed25519Signer
    ), hub);
    if (cast.isOk()) {
        console.log('success');
        res.json('SUCCESS');
    } else {
        console.log(cast.error);
        res.json('FAIL');
    }
})
app.post('/link', async (req, res) => {
    const FID = req.body.fid; // Your fid
    const ed25519Signer = new NobleEd25519Signer(hexToBytes(req.body.pk));
    const dataOptions = {
        fid: FID,
        network: FC_NETWORK,
    };

    const link = await submitMessage(makeLinkAdd(
        {
            type: 'buddy',
            targetFid: 352393,
        },
        dataOptions,
        ed25519Signer
    ));
    if (link.isOk()) {
        console.log('success');
        res.json('SUCCESS');
    } else {
        console.log(cast.error);
        res.json('FAIL');
    }
})

app.post('/react', async (req, res) => {
    const FID = req.body.fid; // Your fid
    const castFid = req.body.castFid;
    const hash = req.body.castHash;
    const type = req.body.type;

    const ed25519Signer = new NobleEd25519Signer(hexToBytes(req.body.pk));
    const dataOptions = {
        fid: FID,
        network: FC_NETWORK,
    };

    const hub = req.body.hub;

    const react = await submitMessage(makeReactionAdd(
        {
            type,
            targetCastId: { fid: castFid, hash: hexToBytes(hash) },
        },
        dataOptions,
        ed25519Signer
    ), hub);
    if (react.isOk()) {
        console.log('success');
        res.json('SUCCESS');
    } else {
        console.log(react.error);
        res.json('FAIL');
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})