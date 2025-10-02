// app.js - WHOT frontend (wallet connect, Hoodi switch, client-side rules, on-chain calls)
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.0/+esm";

/* ===== CONFIG - update ONLY if you must ===== */
const HOODI_RPC = "https://ethereum-hoodi-rpc.publicnode.com";
const HOODI_CHAIN_ID_DEC = 560048;
const HOODI_CHAIN_ID_HEX = "0x88D70"; // 560048 in hex
const WHOT_CONTRACT = "0x68c7a00A968Ba627921CD2885ac906DF56F96ABb";
const TRAP_CONTRACT = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D";
/* =========================================== */

/* Minimal ABI - must match your contract; adjust if needed */
const WHOT_ABI = [
  "function nextGameId() view returns (uint256)",
  "function createGame(uint8,bool) returns (uint256)",
  "function joinGame(uint256,bool)",
  "function startGame(uint256)",
  "function playCard(uint256,uint8,uint8)",
  "function drawOne(uint256)",
  "function declareLast(uint256)",
  "function declareSemiLast(uint256)",
  "function games(uint256) view returns (uint256,address,uint8,uint8,bool,bool,bool,tuple,uint8,uint16,uint8,uint8,uint256)"
];

const TRAP_ABI = ["function collect() view returns (bytes)"];

/* UI elements */
const connectBtn = document.getElementById("connectBtn");
const networkBadge = document.getElementById("networkBadge");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const viewLatestBtn = document.getElementById("viewLatestBtn");
const pickBtn = document.getElementById("pickBtn");
const drawBtn = document.getElementById("drawBtn");
const playBtn = document.getElementById("playBtn");
const declareLastBtn = document.getElementById("declareLast");
const declareSemiBtn = document.getElementById("declareSemi");
const gameIdInput = document.getElementById("gameIdInput");
const maxPlayersInput = document.getElementById("maxPlayers");
const infoGame = document.getElementById("infoGame");
const infoPlayers = document.getElementById("infoPlayers");
const infoTurn = document.getElementById("infoTurn");
const infoStatus = document.getElementById("infoStatus");
const playerHandDiv = document.getElementById("playerHand");
const topCardDiv = document.getElementById("topCard");
const pileMeta = document.getElementById("pileMeta");
const deckCount = document.getElementById("deckCount");
const trapState = document.getElementById("trapState");
const whotLink = document.getElementById("whotLink");
const trapLink = document.getElementById("trapLink");
const logDiv = document.getElementById("log");
const selectedDiv = document.getElementById("selected");
const opponentsDiv = document.getElementById("opponents");

whotLink.href = `https://hoodi.etherscan.io/address/${WHOT_CONTRACT}`;
whotLink.textContent = WHOT_CONTRACT;
trapLink.href = `https://hoodi.etherscan.io/address/${TRAP_CONTRACT}`;
trapLink.textContent = TRAP_CONTRACT;

/* provider/contract state */
let provider = null;
let signer = null;
let whot = null;
let trap = null;
let signerAddress = null;

/* UI local hand (visual) - if your contract exposes hands replace this part */
let uiHand = [
  { number: 3, suitIndex: 0 },
  { number: 2, suitIndex: 2 },
  { number: 8, suitIndex: 4 },
  { number: 14, suitIndex: 1 },
  { number: 20, suitIndex: 5 }
];
let selectedCard = null;

/* SUIT mapping (adjust ordering if your contract uses different enum index) */
const SUIT_NAMES = ["Circle","Triangle","Cross","Square","Star","Whot"];

/* helpers */
function log(msg){
  const el = document.createElement("div");
  el.className = "item";
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.prepend(el);
}
function setNetworkBadge(t){ networkBadge.textContent = `Network: ${t}`; }

/* ===== wallet connect & Hoodi switch ===== */
connectBtn.onclick = connectWallet;

async function connectWallet(){
  if(!window.ethereum){ alert("MetaMask required."); return; }

  // ensure Hoodi is active in wallet
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HOODI_CHAIN_ID_HEX }] });
    setNetworkBadge("Hoodi");
  } catch(switchErr){
    // 4902 -> chain not added
    if(switchErr?.code === 4902){
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: HOODI_CHAIN_ID_HEX,
            chainName: "Ethereum Hoodi Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [HOODI_RPC],
            blockExplorerUrls: ["https://hoodi.etherscan.io"]
          }]
        });
        setNetworkBadge("Hoodi");
      } catch(e){ console.error("Add chain failed", e); alert("Please add Hoodi network to your wallet and retry."); return; }
    } else {
      console.error("Switch chain error", switchErr);
      alert("Please switch to Hoodi testnet (560048)."); return;
    }
  }

  // request accounts
  await window.ethereum.request({ method: "eth_requestAccounts" });
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  signerAddress = await signer.getAddress();
  connectBtn.textContent = `${signerAddress.slice(0,6)}…${signerAddress.slice(-4)}`;
  log("Connected " + signerAddress);

  // instantiate contracts
  whot = new ethers.Contract(WHOT_CONTRACT, WHOT_ABI, provider);
  trap = new ethers.Contract(TRAP_CONTRACT, TRAP_ABI, provider);

  // allow signer for write actions (use connect when sending txs)
  // we will connect to signer when sending txs (whot.connect(signer))

  await viewLatest();
}

/* ===== UI: local hand rendering & selection (replace with contract hand if available) ===== */
function renderLocalHand(){
  playerHandDiv.innerHTML = "";
  uiHand.forEach((c, idx) => {
    const el = document.createElement("div");
    el.className = "card " + (c.suitIndex === 5 ? "whot" : SUIT_NAMES[c.suitIndex]?.toLowerCase() ?? "");
    el.textContent = c.number;
    el.onclick = ()=> selectCard(idx);
    playerHandDiv.appendChild(el);
  });
}
function selectCard(idx){
  selectedCard = uiHand[idx];
  selectedDiv.textContent = `Selected: ${selectedCard.number} ${SUIT_NAMES[selectedCard.suitIndex]}`;
}

/* ===== Basic Nigerian Whot rules enforcement (client-side) =====
 - Playable if: same suit OR same number OR Whot (20)
 - Special card handling (basic):
   - 1: HOLD ON -> same player plays again (UI just allows immediate next)
   - 2: PICK TWO -> next player must draw two (contract handles it; UI acknowledges)
   - 5: PICK THREE -> next draws three
   - 8: SUSPENSION -> next player misses turn
   - 14: GENERAL MARKET -> all players draw 1
 - NOTE: Final enforcement must be on-chain. UI only validates before sending tx.
*/
function isPlayable(topCard, card){
  if(!topCard) return true;
  if(card.number === 20) return true; // Whot
  if(card.suitIndex === topCard.suit) return true;
  if(card.number === topCard.number) return true;
  return false;
}

/* ===== contract/ UI actions ===== */
createBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const maxP = Number(maxPlayersInput.value || 4);
  const c = whot.connect(signer);
  try {
    log("Creating game...");
    const tx = await c.createGame(maxP, false);
    await tx.wait?.();
    log("Game created");
    await viewLatest();
  } catch(e){ console.error(e); log("create failed: "+(e?.message||e)); }
};

joinBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  try {
    const c = whot.connect(signer);
    const tx = await c.joinGame(id, false);
    await tx.wait?.();
    log("Joined " + id);
    await loadGame(id);
  } catch(e){ console.error(e); log("join failed: "+(e?.message||e)); }
};

startBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  try {
    const c = whot.connect(signer);
    const tx = await c.startGame(id);
    await tx.wait?.();
    log("Started " + id);
    await loadGame(id);
  } catch(e){ console.error(e); log("start failed: "+(e?.message||e)); }
};

pickBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  try {
    const c = whot.connect(signer);
    const tx = await c.drawOne(id);
    await tx.wait?.();
    log("Drew one from market");
    await loadGame(id);
  } catch(e){ console.error(e); log("pick error:"+ (e?.message||e)); }
};
drawBtn.onclick = pickBtn.onclick;

playBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0); if(!id) return alert("Enter game id");
  if(!selectedCard) return alert("Select a card");
  // get top card from UI
  const topText = topCardDiv.textContent || "";
  let top = null;
  if(topText && topText !== "—") {
    const parts = topText.split(" ");
    top = { number: Number(parts[0]), suitName: parts[1] };
    // find suit index
    top.suit = SUIT_NAMES.indexOf(top.suitName);
  }

  if(!isPlayable(top, selectedCard)){
    alert("Card not playable per Whot rules.");
    return;
  }

  try {
    const c = whot.connect(signer);
    // selectedCard: {number, suitIndex}
    const tx = await c.playCard(id, selectedCard.number, selectedCard.suitIndex);
    await tx.wait?.();
    log(`Played ${selectedCard.number} ${SUIT_NAMES[selectedCard.suitIndex]}`);
    // local UI update: remove card from uiHand if it came from uiHand
    const idx = uiHand.findIndex(x=>x.number===selectedCard.number && x.suitIndex===selectedCard.suitIndex);
    if(idx>=0) uiHand.splice(idx,1);
    selectedCard = null; selectedDiv.textContent = "Selected: none";
    await loadGame(id);
  } catch(e){ console.error(e); log("play failed:"+ (e?.message||e)); }
};

declareLastBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0); if(!id) return alert("Enter game id");
  try { const c = whot.connect(signer); const tx = await c.declareLast(id); await tx.wait?.(); log("Declared last"); await loadGame(id); } catch(e){ log("declareLast err:"+ (e?.message||e)); }
};
declareSemiBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0); if(!id) return alert("Enter game id");
  try { const c = whot.connect(signer); const tx = await c.declareSemiLast(id); await tx.wait?.(); log("Declared semi-last"); await loadGame(id); } catch(e){ log("declareSemi err:"+ (e?.message||e)); }
};

/* ===== load / display game =====
   Note: parseGameStruct is best-effort; tune it to your contract shape.
*/
function parseGameStruct(res){
  try {
    // expected mapping return shape - adapt indexes if your contract differs
    // many templates: id, creator, playersJoined, currentTurn, started, finished, ...
    const id = Number(res[0] ?? 0);
    const creator = res[1] ?? null;
    const playersJoined = Number(res[2] ?? 0);
    const currentTurn = Number(res[3] ?? 0);
    const started = !!res[4];
    const finished = !!res[5];
    let lastCard = null;
    try {
      const maybe = res[7];
      if(maybe){
        const cardNumber = Number(maybe[0] ?? maybe.number ?? 0);
        const cardSuit = Number(maybe[1] ?? maybe.suit ?? 0);
        lastCard = { number: cardNumber, suit: cardSuit };
      }
    } catch(e) { lastCard = null; }
    return { id, creator, playersJoined, currentTurn, started, finished, lastCard };
  } catch(e){
    return null;
  }
}

async function loadGame(id){
  if(!id) return;
  try {
    const res = await whot.games(id);
    const parsed = parseGameStruct(res);
    infoGame.textContent = parsed?.id ?? "—";
    infoPlayers.textContent = parsed?.playersJoined ?? "—";
    infoTurn.textContent = parsed?.currentTurn ?? "—";
    infoStatus.textContent = parsed?.started ? (parsed?.finished ? "Finished":"Started") : "Waiting";

    if(parsed?.lastCard){
      const sName = SUIT_NAMES[parsed.lastCard.suit] ?? `s${parsed.lastCard.suit}`;
      topCardDiv.textContent = `${parsed.lastCard.number} ${sName}`;
      pileMeta.textContent = `Players: ${parsed.playersJoined} • ${infoStatus.textContent}`;
    } else {
      topCardDiv.textContent = "—";
      pileMeta.textContent = `Players: ${parsed?.playersJoined ?? "—"}`;
    }

    // Update opponents UI
    opponentsDiv.innerHTML = "";
    for(let i=0;i<Math.max(2, parsed?.playersJoined ?? 2); i++){
      const p = document.createElement("div");
      p.className = "card";
      p.style.width = "56px"; p.style.height = "56px";
      p.textContent = `P${i+1}`;
      opponentsDiv.appendChild(p);
    }

    // trap info
    try {
      const raw = await trap.collect();
      const abi = ethers.AbiCoder.defaultAbiCoder();
      try {
        const dec = abi.decode(["uint256","uint8","uint8","bool","bool","uint256"], raw);
        trapState.textContent = `last:${dec[0]} players:${dec[1]} started:${dec[3]}`;
      } catch(_) {
        trapState.textContent = raw ? raw.toString() : "—";
      }
    } catch(e){ trapState.textContent = "trap error"; }

    // render UI hand (placeholder unless contract exposes hand)
    renderLocalHand();
    log("Loaded game " + id);
  } catch(e){
    console.error("loadGame err:", e);
    log("loadGame err: " + (e?.message||e));
  }
}

async function viewLatest(){
  try {
    const n = await whot.nextGameId();
    const last = Math.max(1, Number(n) - 1);
    gameIdInput.value = last;
    await loadGame(last);
  } catch(e) {
    console.error("viewLatest err", e);
    log("viewLatest err: " + (e?.message||e));
  }
}

/* init UI */
(async function init(){
  renderLocalHand();
  // attempt to show latest game id placeholder
  try { const n = await (new ethers.JsonRpcProvider(HOODI_RPC)).send("eth_call",[]).catch(()=>null); } catch(e){}
})();
