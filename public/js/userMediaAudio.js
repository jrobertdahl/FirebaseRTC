export const userMediaAudio = {
  //for chrome
  mandatory: {
    // autoGainControl: "false",
    echoCancellation: "true", //I think this needs to be set to true
    googAutoGainControl: "false", //not sure about this one
    googEchoCancellation: "true", //I think this needs to be set to true
    googNoiseSuppression: "false", //sounds better set to false
    googHighpassFilter: "true",
  },
  optional: [],
  //for ff
  // audio : {
  //   "mandatory": {
  //       "echoCancellation": "true"
  //   }
  // }
};
