const express = require('express')
const app = express()
const port = 3001
const cors = require('cors')
const {hexToBytes} = require('viem')
const  {
    FarcasterNetwork,
    getInsecureHubRpcClient, makeCastAdd, NobleEd25519Signer, makeReactionAdd, makeLinkAdd
} = require("@farcaster/hub-nodejs")

const HUB_URL = "3.141.108.149:2283"; // URL + Port of the Hub
const client = getInsecureHubRpcClient(HUB_URL);
const FC_NETWORK = FarcasterNetwork.MAINNET;

app.use(cors())
app.use(express.json())    // <==== parse request body as JSON

app.get('/', (req, res) => {
    res.json('Hello World!')
})

const submitMessage = async (resultPromise) => {
    const result = await resultPromise;
    if (result.isErr()) {
        throw new Error(`Error creating message: ${result.error}`);
    }
    return await client.submitMessage(result.value);
};
app.post('/cast', async (req, res) => {
    const FID = req.body.fid; // Your fid
    const ed25519Signer = new NobleEd25519Signer(hexToBytes(req.body.pk));
    const dataOptions = {
        fid: FID,
        network: FC_NETWORK,
    };

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
    ));
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
    const ed25519Signer = new NobleEd25519Signer(hexToBytes(req.body.pk));
    const dataOptions = {
        fid: FID,
        network: FC_NETWORK,
    };

    const castHash = '0x10294e1f86254bd7cb778669f5fa217296c8c7db';

    const react = await submitMessage(makeReactionAdd(
        {
            type: 1,
            targetCastId: { fid: 390759, hash: hexToBytes(castHash) },
        },
        dataOptions,
        ed25519Signer
    ));
    if (react.isOk()) {
        console.log('success');
        res.json('SUCCESS');
    } else {
        console.log(cast.error);
        res.json('FAIL');
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})