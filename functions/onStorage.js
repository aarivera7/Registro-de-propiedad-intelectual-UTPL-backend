const {onObjectDeleted, onObjectFinalized} =
  require("firebase-functions/v2/storage");

const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const app = require("./index");
const db = app.db;
const storage = app.storage;


// Ingresa la información de un archivo subido a storage
exports.onCreateDocument = onObjectFinalized(async (event)=>{
  const url = await storage.bucket().file(event.data.name).getSignedUrl({
    action: "read",
    expires: "03-09-2491",
  });
  const filePath = event.data.name;
  const fileSplit = filePath.split("/");
  // const fileName = fileSplit.pop();
  const type = fileSplit[0];

  logger.log("URL: ", url);

  /* if (type == "patent") {
    const typeDocument = fileSplit[2];
    const projectId = fileSplit[3];

    await db.collection("patents").doc(projectId).update({
      [`documents.${typeDocument}.documents`]:
      admin.firestore.FieldValue.arrayUnion(url),
      date: Timestamp.now(),
      status: "Pendiente",
    });

  } else */
  if (type == "messages") {
    const messageId = fileSplit[1];

    await db.collection("messages").doc(messageId).update({
      evidence: url,
    });
  }
});


// Eliminar archivos de storage de un documento eliminado
exports.onDeleteDocument = onObjectDeleted(async (event)=>{
  logger.log("Event: ", event.type);
  const filePath = event.data.name;
  logger.log("File Path: ", filePath);
  const filePathHTML = filePath
      .replaceAll("/", "%2F")
      .replaceAll(" ", "%20");
  const fileSplit = filePath.split("/");
  // const fileName = fileSplit.pop();
  // const type = fileSplit[1];
  const projectId = fileSplit[2];
  const documentType = fileSplit[3];

  const projectData = await db.collection("patents").doc(projectId).get();
  const project = projectData.data();

  if (event.data.metadata.isReplaced == "true") {
    storage.bucket().setMetadata(filePath, {
      metadata: {
        isReplaced: "false",
      },
    });
    return;
  }

  if (project.documents[documentType].documents.length == 1) {
    await db.collection("patents").doc(projectId).update({
      [`documents.${documentType}`]: admin.firestore.FieldValue.delete(),
    });
  } else {
    project.documents[documentType].documents =
    project.documents[documentType].documents.filter((doc) =>
      !doc.includes(filePathHTML));

    await db.collection("patents").doc(projectId).update({
      [`documents.${documentType}.documents`]:
      project.documents[documentType].documents,
    });
  }
});
