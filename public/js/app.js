import { openUserMedia } from "./openUserMedia.js";
import { createConnection } from "./createConnection.js";

let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;
const db = firebase.firestore();

//---------------------

function init() {
  document.querySelector("#cameraBtn").addEventListener("click", function () {
    openUserMedia().then((stream) => {
      document.querySelector("#localVideo").srcObject = localStream = stream;
    });
  });
  // document.querySelector("#hangupBtn").addEventListener("click", hangUp);
  document.querySelector("#createBtn").addEventListener("click", createRoom);
  document.querySelector("#joinBtn").addEventListener("click", showJoinModal);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector("#room-dialog"));
}

//---------------------

async function createRoom() {
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  remoteStream = new MediaStream();

  document.querySelector("#remoteVideo").srcObject = remoteStream;

  const roomRef = await db.collection("rooms").doc();

  const peerConnection = await createConnection(
    "callerCandidates",
    roomRef,
    localStream,
    remoteStream
  );

  const offer = await peerConnection.createOffer();

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  };

  await peerConnection.setLocalDescription(offer);

  await roomRef.set(roomWithOffer);

  roomId = roomRef.id;

  roomRef.onSnapshot(async (snapshot) => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });

  document.querySelector("#currentRoom").innerText = `${roomRef.id}`;
  //diplaying room id to user that created room
  document.querySelector("#buttons-inner").style.display = "none";
}

//---------------------

function showJoinModal() {
  //this function basically just opens the join dialog box and and calls joinRoomById, passing the roomID

  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  document.querySelector("#confirmJoinBtn").addEventListener(
    "click",
    async () => {
      roomId = document.querySelector("#room-id").value;
      await joinRoomById(roomId);
    },
    { once: true }
  );
  //
  roomDialog.open();
}

//---------------------

async function joinRoomById(roomId) {
  remoteStream = new MediaStream();

  const roomRef = db.collection("rooms").doc(`${roomId}`);

  const roomSnapshot = await roomRef.get();

  if (roomSnapshot.exists) {
    const peerConnection = await createConnection(
      "calleeCandidates",
      roomRef,
      localStream,
      remoteStream
    );

    const offer = roomSnapshot.data().offer;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };

    await peerConnection.setLocalDescription(answer);

    await roomRef.update(roomWithAnswer);
  }

  document.querySelector("#remoteVideo").srcObject = remoteStream;
}

init();
