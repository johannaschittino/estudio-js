import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCiseMixjVilJDE3TADsr1UEPsnx916VDE',
  authDomain: 'jslifeadvisor-estudio.firebaseapp.com',
  projectId: 'jslifeadvisor-estudio',
  storageBucket: 'jslifeadvisor-estudio.firebasestorage.app',
  messagingSenderId: '700065841504',
  appId: '1:700065841504:web:b4cd8b2232dd0a81c81e05',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
