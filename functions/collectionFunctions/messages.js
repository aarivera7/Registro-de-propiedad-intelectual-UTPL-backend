const app = require("../index");

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const db = app.db;


// Messages
// Nuevo mensaje
exports.newMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  if (!request.data.subject) {
    throw new HttpsError("invalid-argument", "subject is required!",
        {subject: request.data.subject});
  }

  if (!request.data.projectId) {
    throw new HttpsError("invalid-argument", "projectId is required!",
        {projectId: request.data.projectId});
  }

  const projectRef = db.collection("projects").doc(request.data.projectId);
  const projectData = projectRef.get();

  const userRef = db.collection("users").doc(request.auth.uid);
  const userData = userRef.get();

  const project = (await projectData).data();
  const user = (await userData).data();

  if (!projectData) {
    throw new HttpsError("not-found", "Project not found!");
  }

  if (!userData) {
    throw new HttpsError("not-found", "User not found!");
  }

  const ref = await db.collection("messages").add({
    subject: request.data.subject,
    projectId: request.data.projectId,
    project: project.name,
    senderUID: request.auth.uid,
    sender: user.name + " " + user.lastName,
    date: Timestamp.now(),
    responses: [],
  });

  return {messageId: ref.id};
});


// Nueva respuesta
exports.newResponse = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  if (!request.data.messageId) {
    throw new HttpsError("invalid-argument", "messageId is required!");
  }

  const messageRef = db.collection("messages").doc(request.data.messageId);
  const messageData = messageRef.get();

  const userRef = db.collection("users").doc(request.auth.uid);
  const userData = userRef.get();

  const message = (await messageData).data();
  const user = (await userData).data();

  if (!messageData) {
    throw new HttpsError("not-found", "Message not found!");
  }

  if (!userData) {
    throw new HttpsError("not-found", "User not found!");
  }

  if (message.senderUID !== request.auth.uid && user.rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!",
        {message: message, user: user});
  }

  await db.collection("messages").doc(request.data.messageId).update({
    responses: admin.firestore.FieldValue.arrayUnion({
      uid: request.auth.uid,
      name: user.name + " " + user.lastName,
      date: Timestamp.now(),
      response: request.data.response,
    }),
  });

  return {message: "Response sent successfully!"};
});
