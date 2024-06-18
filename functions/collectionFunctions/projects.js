const app = require("../index");

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {getUser} = require("../firebase");
const {log} = require("firebase-functions/logger");
const {SafeString} = require("handlebars");


const db = app.db;
const sendEmail = require("../mailer");

// Obterner el proyecto de la firestore
/**
 * Retrieves a project based on the provided parameters.
 * @param {Promise} userPromise - A promise that resolves to the user object.
 * @param {string} id - The ID of the project to retrieve.
 * @param {Array} roles - An array of roles that are allowed to access the
 * project.
 * @param {boolean} [returnRef=false] - Optional parameter to indicate whether
 * to return a reference to the project.
 * @return {Promise |
 * FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>}
 *  - A promise that resolves to the project document or
 * a reference to it.
 * @throws {HttpsError} - Throws an error if the provided arguments are
 * invalid or if the user is not authorized.
 */
async function getProject(userPromise, id, roles, returnRef = false) {
  if (!id) {
    throw new HttpsError("invalid-argument", "id is required!", {id: id});
  }

  if (!roles) {
    throw new HttpsError("invalid-argument", "roles is required!",
        {roles: roles});
  }

  if (!Array.isArray(roles)) {
    throw new HttpsError("invalid-argument", "roles must be an array!",
        {roles: roles});
  }

  if (roles.length == 0) {
    throw new HttpsError("invalid-argument", "roles cannot be empty!",
        {roles: roles});
  }

  if (returnRef && roles.includes(user.data().rol)) {
    return db.collection("patents").doc(id);
  }

  const project = db.collection("patents").doc(id).get();


  const user = await userPromise;

  if (roles.includes(user.data().rol)) {
    project.catch((error) => {
      throw new HttpsError("not-found", "Project not found!", {error: error});
    });

    return project;
  } else {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }
}


// Projects
// Publicar un proyecto que ha finalizado su proceso de aprobación
exports.publishProject = onCall(async (request) => {
  const userPromise = getUser(request.auth.uid);

  const project =
      (await getProject(userPromise, request.data.id, ["admin"])).data();

  const documentRef =
      db.collection("patents").doc(request.data.id);

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

  await sendEmail(
      project.email,
      "Solicitud de propiedad intelectual para \"" + project.name + "\"",
      {
        title: "SOLICITUD DE PROPIEDAD INTELECTUAL",
        name: project.nameAuthor,
        body: "Le informamos que la solicitud de propiedad intelectual" +
        " se ha ingresado correctamente, puede descargar el certificado " +
        "emitido en el sistema para su descarga respectiva.",
        items: new SafeString(`<b>Nombre de invensión:</b> ${project.name}<br>
        <b>Fecha de presentación:</b> 
        ${Timestamp.now().toDate().toISOString()}<br>
        <b>Tipo de propiedad:</b> ${project.type}<br>
        <b>Certificado para descargar:</b><br>`),
        button: new SafeString(`<a class="button"
          href="${project.application.document}"
        target="_black" >IR AL SISTEMA</a>`),
      },
  ).catch((error) => {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  });

  return {message: "Project approved successfully!"};
});


// Aprobar inicio del registro de un proyecto
exports.approveProject = onCall(async (request) => {
  const userPromise = getUser(request.auth.uid);

  const project =
      (await getProject(userPromise, request.data.id, ["admin"])).data();

  await db.collection("patents").doc(request.data.id).update({
    status: "Aprobado",
  });

  await sendEmail(
      project.email,
      "Proyecto de Propiedad Intelectual \"" + project.name + "\" aprobado",
      {
        tile: "APROBACIÓN PARA INICIO DE PROCESO",
        name: project.nameAuthor,
        body: "Le informamos que el registro de \"" + project.name + "\"" +
        " HA SIDO APROBADO para el inicio del proceso de registro" +
        "de propiedad intelectual. Se da inicio al registro de la solicitud" +
        "con los siguientes datos: ",
        items: new SafeString(`<b>Nombre del autor:</b> 
          ${project.nameAuthor}<br>
        <b>Fecha de presentación:</b> ${project.createDate.toDate()
      .toISOString()}<br>
        <b>Tipo de propiedad:</b> ${project.type}<br>`),
        button: new SafeString(`<a class="button" href="https://patentes-utpl.web.app/"
        target="_black" >IR AL SISTEMA</a>`),
      },
  ).catch((error) => {
    log("Error sending email!", {error: error});
    throw new HttpsError("internal", "Error sending email!", {error: error});
  });

  return {message: "Project approved successfully!"};
});


// Desaprobar inicio del registro de un proyecto
module.exports.nonApproveProject = onCall(async (request) => {
  const userPromise = getUser(request.auth.uid);

  const project =
      (await getProject(userPromise, request.data.id, ["admin"])).data();

  await db.collection("patents").doc(request.data.id).update({
    status: "No aprobado",
  });

  await sendEmail(
      project.email,
      "Proyecto de Propiedad Intelectual \"" + project.name + "\" rechazado",
      {
        title: "RECHAZO PARA INICIO DE PROCESO",
        name: project.nameAuthor,
        body: "Le informamos que el registro de \"" + project.name + "\"" +
        " NO HA SIDO APROBADO para el inicio del proceso de registro" +
        "de propiedad intelectual. Se ha desaprobado el registro de la" +
        " solicitud con los siguientes datos: ",
        items: new SafeString(`<b>Nombre del autor:</b> 
          ${project.nameAuthor}<br>
        <b>Fecha de presentación:</b> ${project.createDate.toDate()
      .toISOString()}<br>
        <b>Tipo de propiedad:</b> ${project.type}<br>`),
        button: new SafeString(`<a class="button"
          href="https://patentes-utpl.web.app/" 
          target="_black" >IR AL SISTEMA</a>`),
      },
  ).catch((error) => {
    log(error);
    throw new HttpsError("internal", "Error sending email!", {error: error});
  });

  return {message: "Project disapproved successfully!"};
});


// Eliminar un proyecto
exports.deleteProject = onCall(async (request) => {
  const user = await getUser(request.auth.uid);

  if (user.data().rol === "admin") {
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
  const userPromise = getUser(request.auth.uid);

  const project =
      (await getProject(userPromise, request.data.id, ["admin"])).data();

  if (!request.data.typeEmail) {
    throw new HttpsError("invalid-argument", "typeEmail is required!",
        {typeEmail: request.data.typeEmail});
  }

  const body1 = "Le informamos que ";
  const body2 = ", puede continuar con el proceso correspondiente aquí: ";
  const subjectApprovedFinal =
  `Proyecto "${project.name}", Aprobación de paso ${project.numStep -1}`;


  if (request.data.typeEmail == "approved-step1" &&
    project.approveStep1 && project.type == "patent") {
    return await sendEmail(
        project.email,
        subjectApprovedFinal,
        {
          title: "REQUISITOS PARA REVISIÓN DE ESTADO DE LA TÉCNICA",
          name: project.nameAuthor,
          body: body1 + "los requisitos para revisión de estado de la " +
          "técnica HA SIDO APROBADO" + body2,
          items: `<b>Fecha de presentación: </b>
          ${project.createDate.toDate().toISOString()}`,
          button: `<a class="button" href="https://patentes-utpl.web.app/" 
          target="_black" >IR AL SISTEMA</a>`,
        },
    );
  } else if (request.data.typeEmail == "approved-step2") {
    return await sendEmail(
        project.email,
        subjectApprovedFinal,
        {
          title: "ELABORACIÓN DE MEMORIA DESCRIPTIVA",
          name: project.nameAuthor,
          body: body1 + "la elaboración de la memoria descriptiva" +
          " HA SIDO APROBADO" + body2,
          items: `<b>Fecha de presentación: </b>
          ${project.createDate.toDate().toISOString()}`,
          button: `<a class="button" href="https://patentes-utpl.web.app/" 
          target="_black" >IR AL SISTEMA</a>`,
        },
    );
  } else if (request.data.typeEmail == "approved-step5" &&
    project.approveStep5) {
    return await sendEmail(
        project.email,
        subjectApprovedFinal,
        {
          title: "REQUISITOS",
          name: project.nameAuthor,
          body: body1 +
          "se HA SIDO APROBADO todos los requisitos (documentación)" + body2,
          items: `<b>Fecha de presentación: </b>
          ${project.createDate.toDate().toISOString()}`,
          button: `<a class="button" href="https://patentes-utpl.web.app/" 
          target="_black" >IR AL SISTEMA</a>`,
        },
    );
  } else if (request.data.typeEmail == "contract" &&
    project.contract) {
    const subjectContract = `Proyecto "${project.name}", contrato elaborado`;

    return await sendEmail(
        project.email,
        subjectContract,
        {
          title: "ELABORACIÓN DE CONTRATO",
          name: project.nameAuthor,
          body: body1 + "la elaboración del contrato ya está en curso, " +
          "puede ingresar al sistema para descargarlo y proceder " +
          "con la firma electrónica requerida, posterior a ello, " +
          "se requeriere que lo suba en el segundo paso",
          items: `<b>Nombre de invensión:</b> 
          ${project.name}
          <b>Fecha de presentación:</b> ${project.createDate.toDate()
      .toISOString()}
          <b>Tipo de propiedad:</b> ${project.type}`,
          button: `<a class="button" href="${project.contract.document}" 
          target="_black" >IR AL SISTEMA</a>`,
        },
    );
  } else if (request.data.typeEmail == "sendEmail-step1") {
    return await sendEmail(
        "aarivera7@utpl.edu.ec", // sjjumbo3@utpl.edu.ec
        "Revisión del proyecto \"" + project.name + "\"",
        {
          title: "REVISIÓN DE PROYECTO",
          name: project.nameAuthor,
          body: "Le informamos que el proyecto \"" + project.name + "\"" +
          " está listo para la revisión, por favor ingrese al sistema " +
          "para revisar la información ingresada y proceder con la " +
          "aprobación del mismo.",
          items: `<b>Nombre del autor:</b> ${project.nameAuthor}<br>
          <b>Nombre de invensión:</b> ${project.name}
          <b>Fecha de presentación:</b> ${project.createDate.toDate()
      .toISOString()}<br>
          <b>Palabras claves respecto de la invención sujeta al registro:</b>
          ${project.keywords}<br>
          <b>Título tentativo de la invención:</b> 
          ${project.tentativeTitle}<br>
          <b>Breve descripción de la invención:</b> ${project.description}<br>
          <b>Breve resumen de la invención:</b> ${project.summary}<br>
          <b>Tipo de propiedad:</b> Patente<br>`,
          button: `<a class="button" href="https://patentes-utpl.web.app/" 
          target="_black" >IR AL SISTEMA</a>`,
        },
    );
  }
});


// Eliminar datos de un documento
exports.deleteDocument = onCall(async (request) => {
  const userPromise = getUser(request.auth.uid);

  const item =
      (await getProject(userPromise, request.data.id, ["user"])).data();

  item.documents[request.data.type].documents = [];
  item.documents[request.data.type].date = undefined;
  item.documents[request.data.type].status = undefined;
  item.documents[request.data.type].observations = undefined;

  await db.collection("projects").doc(request.data.id).update({
    documents: item.documents,
  });
  return {message: "Document deleted successfully!"};
});


/* const sendEmailTransporter = async (from, to, subject, html) => {
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

const nodemailer = require("nodemailer");

// Define some parameters
const user = defineString("USER_EMAIL");
const pass = defineSecret("PASSWORD_EMAIL");


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
});*/
