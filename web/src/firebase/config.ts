import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBShF4qjrJ_K9nRf_yu-QApowkTrfnxOfE',
  authDomain: 'paneloom.firebaseapp.com',
  projectId: 'bloodtests-v3',
  storageBucket: 'bloodtests-v3.firebasestorage.app',
  messagingSenderId: '173265870142',
  appId: '1:173265870142:web:96d39081cdcec51fe9a06f',
};

export const firebaseApp = initializeApp(firebaseConfig);
