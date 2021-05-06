import { openUserMedia } from "./openUserMedia.js";

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
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
      console.log(localStream);
    });
  });
  // document.querySelector("#hangupBtn").addEventListener("click", hangUp);
  document.querySelector("#createBtn").addEventListener("click", createRoom);
  document.querySelector("#joinBtn").addEventListener("click", joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector("#room-dialog"));

  remoteStream = new MediaStream();
  //setting up remote (incoming) stream to eventually be included in peer connection

  document.querySelector("#remoteVideo").srcObject = remoteStream;
}

//---------------------

async function createRoom() {
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  //connect to firebase database (credentials and details in /__/firebase/init.js)

  const roomRef = await db.collection("rooms").doc();
  //get existing rooms documents

  console.log("Create PeerConnection with configuration: ", configuration);
  peerConnection = new RTCPeerConnection(configuration);
  //creating peer connection object, passing config

  registerPeerConnectionListeners();
  //function that sets up loggin various signaling/ice state changes

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
    //not sure why localStream is being added, it doesn't seem to be overwriting the already set local video scrObj with the track object
    //it looks like the localStream param is used to keep associated tracks grouped together for transmission and in sync on the remote end (maybe?)
  });
  //adding media tracks (in this case, one audio track and one video track) to peer connection

  //start code for collecting ICE candidates
  const callerCandidatesCollection = roomRef.collection("callerCandidates");

  peerConnection.addEventListener("icecandidate", (event) => {
    if (!event.candidate) {
      console.log("Got final candidate!");
      return;
    }
    console.log("Got candidate: ", event.candidate);
    callerCandidatesCollection.add(event.candidate.toJSON());
  });
  //gathering ICE candidates

  //end code for creating ICE candidates

  //start code for creating room

  const offer = await peerConnection.createOffer();
  //creating peer connection offer

  await peerConnection.setLocalDescription(offer);
  //setting offer as local description (to be read by remote)

  console.log("Created offer:", offer);

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  //this offer gets added as a field to the room document

  await roomRef.set(roomWithOffer);
  //adding above offer here

  roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  document.querySelector(
    "#currentRoom"
  ).innerText = `Current room is ${roomRef.id} - You are the caller!`;
  //diplaying room id to user that created room
  document.querySelector("#buttons-inner").style.display = "none";
  //end code for creating room

  //start code for handling incoming remote "join" requests

  peerConnection.addEventListener("track", (event) => {
    console.log("Got remote track:", event.streams[0]);
    event.streams[0].getTracks().forEach((track) => {
      console.log("Add a track to the remoteStream:", track);
      remoteStream.addTrack(track);
    });
  });
  //listener that adds remote tracks to remoteStream (and ultimately to remote html video element)

  //start code for listening for remote session description
  roomRef.onSnapshot(async (snapshot) => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      console.log("Got remote description: ", data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  //end code for listening for remote session description

  //start code for listening for remote ICE candidates
  roomRef.collection("calleeCandidates").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  //end code for listening for remote ICE candidates

  //end code for handling incoming remote "join" requests
}

//---------------------

function joinRoom() {
  //this function basically just opens the join dialog box and and calls joinRoomById, passing the roomID

  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  document.querySelector("#confirmJoinBtn").addEventListener(
    "click",
    async () => {
      roomId = document.querySelector("#room-id").value;
      console.log("Join room: ", roomId);
      document.querySelector(
        "#currentRoom"
      ).innerText = `Current room is ${roomId} - You are the callee!`;
      await joinRoomById(roomId);
    },
    { once: true }
  );
  //
  roomDialog.open();
}

//---------------------

async function joinRoomById(roomId) {
  //connect to firestore db

  const roomRef = db.collection("rooms").doc(`${roomId}`);
  //find the specific room by roomID

  const roomSnapshot = await roomRef.get();
  console.log("Got room:", roomSnapshot.exists);
  //"get"(?) the room

  if (roomSnapshot.exists) {
    console.log("Create PeerConnection with configuration: ", configuration);
    peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners();
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    //this is basically doing all the same stuff as in the create room function

    //start code for collecting ICE candidates
    const calleeCandidatesCollection = roomRef.collection("calleeCandidates");
    peerConnection.addEventListener("icecandidate", (event) => {
      if (!event.candidate) {
        console.log("Got final candidate!");
        return;
      }
      console.log("Got candidate: ", event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });
    //end code for collecting ICE candidates

    peerConnection.addEventListener("track", (event) => {
      console.log("Got remote track:", event.streams[0]);
      event.streams[0].getTracks().forEach((track) => {
        console.log("Add a track to the remoteStream:", track);
        console.log(`remoteStream is ${remoteStream}`);
        remoteStream.addTrack(track);
      });
    });

    //start code for creating SDP answer
    const offer = roomSnapshot.data().offer;
    console.log("Got offer:", offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log("Created answer:", answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    //end code for creating SDP answer

    //start code for listening for remote ICE candidates
    roomRef.collection("callerCandidates").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    //end code for listening for remote ICE candidates
  }

  console.log("end of joinroombyId");
}

//---------------------

//---------------------

async function hangUp(e) {
  const tracks = document.querySelector("#localVideo").srcObject.getTracks();
  tracks.forEach((track) => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector("#localVideo").srcObject = null;
  document.querySelector("#remoteVideo").srcObject = null;
  document.querySelector("#cameraBtn").disabled = false;
  document.querySelector("#joinBtn").disabled = true;
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#hangupBtn").disabled = true;
  document.querySelector("#currentRoom").innerText = "";

  // Delete room on hangup
  if (roomId) {
    const roomRef = db.collection("rooms").doc(roomId);
    const calleeCandidates = await roomRef.collection("calleeCandidates").get();
    calleeCandidates.forEach(async (candidate) => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection("callerCandidates").get();
    callerCandidates.forEach(async (candidate) => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

//---------------------

function registerPeerConnectionListeners() {
  peerConnection.addEventListener("icegatheringstatechange", () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`
    );
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);

    if (peerConnection.connectionState == "connected") {
      document.querySelector("#buttons").style.display = "none";
    }
  });

  peerConnection.addEventListener("signalingstatechange", () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener("iceconnectionstatechange ", () => {
    console.log(
      `ICE connection state change: ${peerConnection.iceConnectionState}`
    );
  });
}

//---------------------

init();
