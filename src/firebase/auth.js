import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

const googleProvider = new GoogleAuthProvider()

async function createUserDoc(user, displayName) {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      displayName: displayName || user.displayName || '',
      email: user.email,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function registerWithEmail(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
  await createUserDoc(credential.user, displayName)
  return credential.user
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider)
  await createUserDoc(credential.user)
  return credential.user
}

export async function logout() {
  await signOut(auth)
}
