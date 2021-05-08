import { iceConfiguration } from "./iceConfiguration.js";

export async function createConnection(
  callParticipant,
  roomRef,
  localStream,
  remoteStream
) {
  const peerConnection = new RTCPeerConnection(iceConfiguration);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  const calleeCandidatesCollection = roomRef.collection("calleeCandidates");

  peerConnection.addEventListener("icecandidate", (event) => {
    if (!event.candidate) {
      return;
    }
    calleeCandidatesCollection.add(event.candidate.toJSON());
  });

  peerConnection.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  });

  roomRef.collection(callParticipant).onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        let data = change.doc.data();
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  return peerConnection;
}
