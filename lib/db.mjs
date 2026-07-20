import crypto from "crypto";
import { parseVocab, applyGrade } from "./srs.mjs";
import clientPromise from "./mongodb.mjs";

const uid = () => crypto.randomUUID();

async function getDb() {
  const client = await clientPromise;
  return client.db(); 
}

async function getLessonsCollection() {
  const db = await getDb();
  return db.collection("lessons");
}

async function getCardsCollection() {
  const db = await getDb();
  return db.collection("cards");
}

const EMPTY = { source: "", title: "", myAnswer: "", correctAnswer: "", mistake: "", info: "", paraphrase: "", vocabRaw: "", link: "" };

export async function getLessons() {
  const collection = await getLessonsCollection();
  const items = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return items.map(({ _id, ...rest }) => rest);
}

async function syncCards(lesson) {
  const cardsCollection = await getCardsCollection();
  const parsed = parseVocab(lesson.vocabRaw || "");
  const keep = new Set(parsed.map((p) => p.front.toLowerCase()));
  
  const existingCards = await cardsCollection.find({ lessonId: lesson.id }).toArray();
  
  const cardsToDelete = existingCards.filter(c => !keep.has(c.front.toLowerCase())).map(c => c.id);
  if (cardsToDelete.length > 0) {
    await cardsCollection.deleteMany({ id: { $in: cardsToDelete } });
  }

  for (const p of parsed) {
    const found = existingCards.find((c) => c.front.toLowerCase() === p.front.toLowerCase());
    if (found) {
      await cardsCollection.updateOne(
        { id: found.id },
        { $set: { back: p.back, lessonTitle: lesson.title } }
      );
    } else {
      await cardsCollection.insertOne({
        id: uid(),
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        front: p.front,
        back: p.back,
        reps: 0,
        ease: 2.5,
        interval: 0,
        lapses: 0,
        due: Date.now(),
        createdAt: Date.now(),
      });
    }
  }
}

export async function createLesson(data = {}) {
  const collection = await getLessonsCollection();
  const now = Date.now();
  const ls = { id: uid(), ...EMPTY, ...data, createdAt: now, updatedAt: now };
  
  await collection.insertOne(ls);
  await syncCards(ls);
  
  const { _id, ...rest } = ls;
  return rest;
}

export async function updateLesson(id, data = {}) {
  const collection = await getLessonsCollection();
  const existing = await collection.findOne({ id });
  if (!existing) return null;
  
  const updated = { ...existing, ...data, id, updatedAt: Date.now() };
  delete updated._id; 
  
  await collection.updateOne({ id }, { $set: updated });
  await syncCards(updated);
  
  return updated;
}

export async function deleteLesson(id) {
  const lessonsCollection = await getLessonsCollection();
  const cardsCollection = await getCardsCollection();
  
  await cardsCollection.deleteMany({ lessonId: id });
  await lessonsCollection.deleteOne({ id });
}

export async function getCards() {
  const collection = await getCardsCollection();
  const items = await collection.find({}).toArray();
  return items.map(({ _id, ...rest }) => rest);
}

export async function deleteCard(id) {
  const collection = await getCardsCollection();
  await collection.deleteOne({ id });
}

export async function getDueCards() {
  const collection = await getCardsCollection();
  const now = Date.now();
  const items = await collection.find({ due: { $lte: now } }).sort({ due: 1 }).toArray();
  return items.map(({ _id, ...rest }) => rest);
}

export async function gradeCard(id, grade) {
  const collection = await getCardsCollection();
  const c = await collection.findOne({ id });
  if (!c) return null;
  
  applyGrade(c, grade);
  
  const updated = { ...c };
  delete updated._id;
  
  await collection.updateOne({ id }, { $set: updated });
  return updated;
}

export async function upsertLessons(dataArray = []) {
  if (!dataArray || dataArray.length === 0) return [];
  
  const collection = await getLessonsCollection();
  const now = Date.now();
  const results = [];
  
  for (const data of dataArray) {
    let query = null;
    if (data.title && data.title.trim() !== "") {
      query = { title: data.title.trim() };
    } else if (data.link && data.link.trim() !== "") {
      query = { link: data.link.trim() };
    }
    
    let ls;
    if (query) {
      const existing = await collection.findOne(query);
      if (existing) {
        const updated = {
          ...existing,
          ...data,
          id: existing.id, 
          updatedAt: now
        };
        delete updated._id;
        
        await collection.updateOne({ id: existing.id }, { $set: updated });
        await syncCards(updated);
        results.push(updated);
        continue;
      }
    }
    
    ls = { id: uid(), ...EMPTY, ...data, createdAt: now, updatedAt: now };
    await collection.insertOne(ls);
    await syncCards(ls);
    results.push(ls);
  }
  
  return results.map(r => {
    const { _id, ...rest } = r;
    return rest;
  });
}
export async function updateCardState(id, state) { const col = await getCardsCollection(); await col.updateOne({ id }, { $set: state }); }

export async function updateCardState(id, state) {
  const col = await getCardsCollection();
  await col.updateOne({ id }, { $set: state });
}
