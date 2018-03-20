const Promise = require('bluebird'),
    { waitOnCommitAck, waitOnRevealAck } = require('./ack'),
    { isValidEcPrivateAddress } = require('./addresses'),
    { validateChainInstance, composeChainCommit, composeChainReveal } = require('./chain'),
    { validateEntryInstance, composeEntryCommit, composeEntryReveal } = require('./entry');


// TODO: unify addEntry and addChain 
async function addChain(factomd, chain, ecPrivate, commitAckTo, revealAckTo) {
    validateChainInstance(chain);
    if (!isValidEcPrivateAddress(ecPrivate)) {
        throw new Error(`${ecPrivate} is not a valid EC private address`);
    }
    const commitAckTimeout = commitAckTo || 60;
    const revealAckTimeout = revealAckTo || 60;

    let committed, revealed;
    if (commitAckTimeout < 0) {
        const result = await Promise.all([
            commitChain(factomd, chain, ecPrivate, commitAckTimeout),
            revealChain(factomd, chain, revealAckTimeout)
        ]);
        committed = result[0];
        revealed = result[1];
    } else {
        committed = await commitChain(factomd, chain, ecPrivate, commitAckTimeout);
        revealed = await revealChain(factomd, chain, revealAckTimeout);
    }

    return Object.assign({}, committed, revealed);
}

// TODO: unify commitEntry and commitChain 
async function commitChain(factomd, chain, ecPrivate, to) {
    const ackTimeout = to || 60;
    const commit = composeChainCommit(chain, ecPrivate).toString('hex');

    let repeatedCommit = false;
    const committed = await factomd.commitChain(commit).catch(function(e) {
        if (e.message === 'Repeated Commit') {
            repeatedCommit = true;
        } else {
            throw e;
        }
    });

    if (committed && ackTimeout >= 0) {
        await waitOnCommitAck(factomd, committed.txid, ackTimeout);
    }

    return {
        txId: committed ? committed.txid : undefined,
        repeatedCommit: repeatedCommit
    };
}

// TODO: unify revealEntry and revealChain 
async function revealChain(factomd, chain, to) {
    const ackTimeout = to || 60;
    const reveal = composeChainReveal(chain).toString('hex');

    const revealed = await factomd.revealChain(reveal);
    if (ackTimeout >= 0) {
        await waitOnRevealAck(factomd, revealed.entryhash, revealed.chainid, ackTimeout);
    }

    return {
        chainId: revealed.chainid,
        entryHash: revealed.entryhash,
    };
}

function addChains(factomd, chains, ecAddress) {
    return Promise.map(chains, chain => addChain(factomd, chain, ecAddress));
}

async function addEntry(factomd, entry, ecPrivate, commitAckTo, revealAckTo) {
    validateEntryInstance(entry);
    if (!entry.chainId.length) {
        throw new Error('Entry doesn\'t contain a chainId to add entry');
    }
    if (!isValidEcPrivateAddress(ecPrivate)) {
        throw new Error(`${ecPrivate} is not a valid EC private address`);
    }

    const commitAckTimeout = commitAckTo || 60;
    const revealAckTimeout = revealAckTo || 60;

    let committed, revealed;
    if (commitAckTimeout < 0) {
        const result = await Promise.all([
            commitEntry(factomd, entry, ecPrivate, commitAckTimeout),
            revealEntry(factomd, entry, revealAckTimeout)
        ]);
        committed = result[0];
        revealed = result[1];
    } else {
        committed = await commitEntry(factomd, entry, ecPrivate, commitAckTimeout);
        revealed = await revealEntry(factomd, entry, revealAckTimeout);
    }

    return Object.assign({}, committed, revealed);
}

async function commitEntry(factomd, entry, ecPrivate, to) {
    const ackTimeout = to || 60;
    const commit = composeEntryCommit(entry, ecPrivate).toString('hex');

    let repeatedCommit = false;
    const committed = await factomd.commitEntry(commit).catch(function(e) {
        if (e.message === 'Repeated Commit') {
            repeatedCommit = true;
        } else {
            throw e;
        }
    });

    if (committed && ackTimeout >= 0) {
        await waitOnCommitAck(factomd, committed.txid, ackTimeout);
    }

    return {
        txId: committed ? committed.txid : undefined,
        repeatedCommit: repeatedCommit
    };
}

async function revealEntry(factomd, entry, to) {
    const ackTimeout = to || 60;
    const reveal = composeEntryReveal(entry).toString('hex');

    const revealed = await factomd.revealChain(reveal);
    if (ackTimeout >= 0) {
        await waitOnRevealAck(factomd, revealed.entryhash, revealed.chainid, ackTimeout);
    }

    return {
        chainId: revealed.chainid,
        entryHash: revealed.entryhash,
    };
}

function addEntries(factomd, entries, ecAddress) {
    return Promise.map(entries, entry => addEntry(factomd, entry, ecAddress));
}

module.exports = {
    addChain,
    addChains,
    addEntry,
    addEntries,
    commitEntry,
    revealEntry,
    commitChain,
    revealChain
};