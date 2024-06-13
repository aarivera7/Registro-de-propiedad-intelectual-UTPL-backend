const app = require("../index");

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {defineString} = require("firebase-functions/params");


const db = app.db;
const nodemailer = require("nodemailer");


// Define some parameters
const user = defineString("USER_EMAIL");
const pass = defineString("PASSWORD_EMAIL");


const transporter = nodemailer.createTransport({
  service: "microsoft",
  host: "smtp.office365.com",
  port: 587,
  tls: {
    ciphers: "SSLv3",
  },
  secureConnection: true,
  auth: {
    user: user.value(),
    pass: pass.value(),
  },
});


// Projects
// Publicar un proyecto que ha finalizado su proceso de aprobación
exports.publishProject = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const user = db.collection("users").doc(request.auth.uid);

  const documentRef = db.collection("patents").doc(request.data.id);
  const document = documentRef.get();

  if ((await user.get()).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const project = (await document).data();

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  const batch = db.batch();

  if (project.type == "patent" &&
      project.approveStep1 && project.approveStep5 &&
      project.progressReviewMeeting.assistance &&
      project.finalReviewMeeting.assistance &&
      project.status == "Aprobado" &&
      typeof project.application.document == "string") {
    batch.update(documentRef, {
      publish: true,
    });
  } else if (
    (project.type == "copyright-software" ||
    project.type == "copyright-database" ||
    project.type == "industrial-secret") &&
    project.approveStep1 &&
    project.progressReviewMeeting.assistance &&
    project.status == "Aprobado" &&
    typeof project.application.document == "string") {
    batch.update(documentRef, {
      publish: true,
    });
  } else {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const certificationsRef = db.collection("certifications").doc();

  batch.set(certificationsRef, {
    projectId: request.data.id,
    finishDate: Timestamp.now(),
    name: project.name,
    projectType: project.type,
    project: documentRef,
    registerDate: project.createDate,
    realizedBy: project.nameAuthor,
    application: project.application,
    uid: project.uid,
  });

  await batch.commit();

  const mailOptions = {
    from: user.value(),
    to: project.email,
    subject: `Certificación otorgada para "${project.name}"`,
    html:
    `<h1>Certificación otorgada para "${project.name}"</h1>
    <pre>
    <b>Nombre del autor:</b> ${project.nameAuthor}
    <b>Nombre del proyecto:</b> ${project.name}
    <b>Tipo de proyecto:</b> ${project.type}
    <b>Fecha de presentación:</b> ${project.createDate.toDate().toISOString()}
    <b>Fecha de finalización:</b> ${Timestamp.now().toDate().toISOString()}
    <b>Certificado para descargar:</b>
    <a href="${project.application.document}" target="_black" >Descargar</a>
    </pre>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  }

  return {message: "Project approved successfully!"};
});


// Aprobar inicio del registro de un proyecto
exports.approveProject = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const user = userRef.get();

  const documentRef = db.collection("patents").doc(request.data.id);
  const document = documentRef.get();

  if ((await user).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const project = (await document).data();

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  await db.collection("patents").doc(request.data.id).update({
    status: "Aprobado",
  });

  return {message: "Project approved successfully!"};
});


// Desaprobar inicio del registro de un proyecto
module.exports.nonApproveProject = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const user = db.collection("users").doc(request.auth.uid);

  const documentRef = db.collection("patents").doc(request.data.id);
  const document = documentRef.get();

  if ((await user.get()).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const project = (await document).data();

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  await db.collection("patents").doc(request.data.id).update({
    status: "No aprobado",
  });

  return {message: "Project disapproved successfully!"};
});


// Eliminar un proyecto
exports.deleteProject = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const user = db.collection("users").doc(request.auth.uid);

  if ((await user.get()).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const document = db.collection("patents").doc(request.data.id);
  /* const snap = (await document.get());
  const data = snap.data();
  storage.bucket().deleteFiles({
    prefix: `projects/${data.type}/${snap.id}`,
  });*/

  await document.delete();

  return {message: "Project deleted successfully!"};
});


exports.sendEmail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userData = userRef.get();

  const documentRef = db.collection("patents").doc(request.data.id);
  const document = documentRef.get();

  if ((await userData).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const project = (await document).data();

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  if (!request.data.typeEmail) {
    throw new HttpsError("invalid-argument", "typeEmail is required!",
        {typeEmail: request.data.typeEmail});
  }

  const htmlApprovedStep =
  `<h1>Proyecto "${project.name}", paso ${project.numStep -1} aprobado</h1>
  <pre>
  <b>Nombre del autor:</b> ${project.nameAuthor}
  <b>Fecha de presentación:</b> ${project.createDate.toDate().toISOString()}
  <b>Tipo de propiedad:</b> ${project.type}
  Le informamos que el proyecto "${project.name}" 
  ha sido aprobado en el paso ${project.numStep -1}.
  </pre>`;
  const subjectApprovedFinal =
  `Proyecto "${project.name}", paso ${project.numStep -1} aprobado`;


  if (request.data.typeEmail == "approved-step1" &&
    project.approveStep1) {
    sendEmailTransporter(
        user.value(),
        project.email,
        subjectApprovedFinal,
        htmlApprovedStep,
    );
  } else if (request.data.typeEmail == "approved-step2") {
    sendEmailTransporter(
        user.value(),
        project.email,
        subjectApprovedFinal,
        htmlApprovedStep,
    );
  } else if (request.data.typeEmail == "approved-step5" &&
    project.approveStep5) {
    sendEmailTransporter(
        user.value(),
        project.email,
        subjectApprovedFinal,
        htmlApprovedStep,
    );
  } else if (request.data.typeEmail == "contract" &&
    project.contract) {
    const htmlContract = `<h1>Proyecto "${project.name}"
    , contrato elaborado</h1>
    <pre>
    <b>Nombre del autor:</b> ${project.nameAuthor}
    <b>Fecha de presentación:</b> ${project.createDate.toDate().toISOString()}
    <b>Tipo de propiedad:</b> ${project.type}
    </pre>
    <p>Le informamos que el contrato del proyecto 
    "${project.name}" ha sido elaborado.</p>
    <a href="${project.contract.document}">Link para descargar el contrato
    </a>`;
    const subjectContract = `Proyecto "${project.name}", contrato elaborado`;

    sendEmailTransporter(
        user.value(),
        project.email,
        subjectContract,
        htmlContract,
    );
  } else if (request.data.typeEmail == "sendEmail-step1") {
    const mailOptions = {
      from: user.value(),
      to: "aarivera7@utpl.edu.ec", // sjjumbo3@utpl.edu.ec
      subject: "Revisión del proyecto \"" + project.name + "\"",
      html:
      `<h1>El proyecto "${project.name}" está listo para la revisión</h1>
      <pre>
      <b>Nombre del autor:</b> ${project.nameAuthor}
      <b>Fecha de presentación:</b> ${project.createDate.toDate().toISOString()}
      <b>Palabras claves respecto de la invención sujeta al registro:</b> 
      ${project.keywords}
      <b>Título tentativo de la invención:</b> ${project.tentativeTitle}
      <b>Breve descripción de la invención:</b> ${project.description}
      <b>Breve resumen de la invención:</b> ${project.summary}</pre>`,
    };

    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new HttpsError("internal", "Error sending email!", {error: error});
    }
  }
});


const sendEmailTransporter = async (from, to, subject, html) => {
  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  }
};

// Eliminar datos de un documento
exports.deleteDocument = onCall(async (request) => {
  const document = db.collection("projects").doc(request.data.id);
  const item = (await document.get()).data();
  item.documents[request.data.type].documents = [];
  item.documents[request.data.type].date = undefined;
  item.documents[request.data.type].status = undefined;
  item.documents[request.data.type].observations = undefined;

  await db.collection("projects").doc(request.data.id).update({
    documents: item.documents,
  });
  return {message: "Document deleted successfully!"};
});

