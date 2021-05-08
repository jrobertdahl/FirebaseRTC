firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    console.log("user is logged in");
    console.log(user);
    document.querySelector("#login-link").style.display = "none";
    document.querySelector("#lesson-logged-out-link").style.display = "none";
  } else {
    console.log("no user logged in");
    document.querySelector("#lesson-logged-in-link").style.display = "none";
  }
});
