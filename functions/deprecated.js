// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


/* const express = require("express");
const app = express()
const functions = require("firebase-functions");

app.get("/api/patents", async (req, res) => {
  try{
    const query = db.collection("patents");
    const querySnapshot = await query.get();
    const docs = querySnapshot.docs;

    const response = docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));

    return res.status(200).json(response);
  } catch (error){
    console.log(error);
    return res.status(500).send(error);
  }
});


app.get("/api/patents/:patent_id", async (req, res) => {
  try{
    const doc = db.collection("patents").doc(req.params.patent_id);
    const item = await doc.get();
    const response = item.data();
    return res.status(200).json(response);
  } catch (error){
    console.log(error);
    return res.status(500).send(error);
  }
});


app.post("/api/patents", async (req, res) => {
  try{
    await db.collection("patents")
      .doc() // "/" + req.body.id + "/"
      .create({
          name: req.body.name,
          type: req.body.type,
          members: req.body.members,
          create_date: req.body.create_date,
          description: req.body.description,
          application_date: req.body.application_date
      });
    return res.status(204).json();
  } catch (error){
    console.log(error);
    return res.status(500).send(error);
  }
});


app.delete("/api/patents/:patent_id", async (req, res) => {
  try{
    admin.auth().verifyIdToken(req.headers.authorization).uid
    const document = db.collection("patents").doc(req.params.patent_id)
    item = await document.get()
    type = item.data().type
    const files = storage.bucket()
      .file(`/projects/${type}/${req.params.patent_id}`)
    await files.delete()
    await document.delete()
    return res.status(204).end()
  }catch(error){
    return res.status(500).send(error)
  }
})

app.put("/api/patents/:patent_id", async (req, res) => {
  try{
    const document = db.collection("patents").doc(req.params.patent_id)
    await document.update({
        name: req.body.name,
        type: req.body.type,
        members: req.body.members,
        create_date: req.body.create_date,
        description: req.body.description,
        application_date: req.body.application_date
    })
      return res.status(200).json()
  }catch(error){
    return res.status(500).send(error)
  }
})

exports.app = functions.https.onRequest(app);*/
