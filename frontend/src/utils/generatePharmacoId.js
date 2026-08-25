import { customAlphabet } from 'nanoid';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

export function buildPharmacoId() {
  const year = new Date().getFullYear();
  return `PHR-${year}-${nanoid()}`;
}

async function doesPharmacoIdExist(pharmacoId) {
  if (!db) {
    return false;
  }

  const usersRef = collection(db, 'users');
  const collisionQuery = query(usersRef, where('pharmaco_id', '==', pharmacoId), limit(1));
  const snapshot = await getDocs(collisionQuery);
  return !snapshot.empty;
}

export async function generateUniquePharmacoId() {
  const first = buildPharmacoId();
  const firstCollision = await doesPharmacoIdExist(first);

  if (!firstCollision) {
    return first;
  }

  const second = buildPharmacoId();
  return second;
}
