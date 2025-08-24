import React, { useState, useEffect, useRef } from 'react';
import { Image, StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions, Modal, Pressable, FlatList, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { makeRedirectUri, refreshAsync, revokeAsync } from 'expo-auth-session';
import appTitleImage from '../assets/expense-tracker-title.png';
import { screenWidth, predefined_banks, categories as predefined_categories_flat, months, years } from './common/constants';
import { Colors } from './styles/AllStyles';
import { formatCurrency, getBankIconName } from './common/utils';
import { CustomAlert } from './screens/CustomAlert.js';
import moment from 'moment/min/moment-with-locales';

WebBrowser.maybeCompleteAuthSession();

const CASH_ACCOUNT_ID = 'cash';
const CASH_ACCOUNT = { id: CASH_ACCOUNT_ID, bank: 'Contanti', description: 'Il tuo portafoglio', number: '' };

// Converte l'array di categorie predefinite in una struttura con sottocategorie
const predefined_categories = predefined_categories_flat.map(cat => ({ name: cat, subcategories: [] }));

const getDefaultAccountId = (currentAccounts) => {
  const firstNonCashAccount = currentAccounts.find(acc => acc.id !== CASH_ACCOUNT_ID);
  return firstNonCashAccount ? firstNonCashAccount.id : (currentAccounts.length > 0 ? currentAccounts[0].id : null);
};

// Componente principale dell'app
const App = () => {
  // Stati per i dati dell'applicazione
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Altro');
  const [subcategory, setSubcategory] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'addExpense', 'addIncome', 'manageAccounts', 'configuration', 'manageCategories', 'manageSubcategories', 'allTransactions'
  const [editingId, setEditingId] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('year'); // 'month', 'year'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [budgets, setBudgets] = useState({ total: 0, categories: {} });
  const [dashboardView, setDashboardView] = useState('balance'); // 'balance', 'expenses', 'income'
  const [budgetSelectedMonth, setBudgetSelectedMonth] = useState(new Date().getMonth() + 1);
  const [budgetSelectedYear, setBudgetSelectedYear] = useState(new Date().getFullYear());
  const [isCalendarSyncEnabled, setIsCalendarSyncEnabled] = useState(false);

  const [transactionDate, setTransactionDate] = useState(new Date());
  const [recurringTransactions, setRecurringTransactions] = useState([]);

  // Stati per il form di ricorrenza
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceCount, setRecurrenceCount] = useState('12');
  // Stati per il popup personalizzato
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [alertOnConfirm, setAlertOnConfirm] = useState(() => {});
  const [alertOnCancel, setAlertOnCancel] = useState(() => () => {});
  const [showCancelButton, setShowCancelButton] = useState(false);

  // Stati per la gestione dei conti
  const [accountBank, setAccountBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDescription, setAccountDescription] = useState('');
  const [isBankModalVisible, setIsBankModalVisible] = useState(false);
  const [filteredBanks, setFilteredBanks] = useState(predefined_banks);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Stati per Google Drive
  const [userInfo, setUserInfo] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Stati per la gestione delle categorie
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const categoryInputRef = useRef(null);
  const categoryScrollViewRef = useRef(null);
  
  // Stati per la gestione delle sottocategorie
  const [selectedCategoryForSubcat, setSelectedCategoryForSubcat] = useState(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [editingSubcategoryName, setEditingSubcategoryName] = useState(null);
  const [tempBudgets, setTempBudgets] = useState({ total: 0, categories: {} });


  // Funzione per mostrare il popup personalizzato
  const showCustomAlert = (title, message, onConfirm, onCancel = () => {setIsAlertVisible(false)}, showCancel = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOnConfirm(() => onConfirm);
    setAlertOnCancel(() => onCancel);
    setShowCancelButton(showCancel);
    setIsAlertVisible(true);
  };

  // Configurazione Autenticazione Google
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke'
  };

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      // ATTENZIONE: Sostituisci con i tuoi Client ID da Google Cloud Console
      webClientId: '273919129646-q1s9blu3r1aeikqq36ccs04muu463g8r.apps.googleusercontent.com',
      androidClientId: '273919129646-igop9vk2e00j39rcnmobacsqi3r0ajb7.apps.googleusercontent.com', // Sostituire con il proprio
      scopes: ['openid', 'https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/calendar'],
      extraParams: {
        access_type: 'offline',
      },
      redirectUri: makeRedirectUri({
        scheme: 'com.galford81.expensetracker',
        native: 'com.galford81.expensetracker://',
      }),
    }
  );

  // Gestisce la risposta di autenticazione
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication) {
        AsyncStorage.setItem('googleAuth', JSON.stringify(authentication));
        fetchUserInfo(authentication); // Passa l'oggetto intero
      }
    }
  }, [response]);

  // Carica i dati da Async Storage all'avvio
  const loadData = async () => {
    try {
      let loadedTransactions = [];
      let loadedRecurring = [];
      const storedData = await AsyncStorage.getItem('financeData');
      let loadedAccounts = [];
      let finalCategories = [];

      if (storedData) {
        const parsedData = JSON.parse(storedData);

        // --- CATEGORY LOGIC ---
        let userCategories = [];
        if (parsedData.categories) {
          // Check for old format (array of strings) and migrate
          if (parsedData.categories.length > 0 && typeof parsedData.categories[0] === 'string') {
            userCategories = parsedData.categories.map(c => ({ name: c, subcategories: [] }));
          } else {
            userCategories = parsedData.categories;
          }
        }

        // Merge user categories with predefined ones, ensuring no duplicates
        const mergedCategories = [...userCategories];
        const categoryNames = new Set(userCategories.map(c => c.name));

        predefined_categories.forEach(predefinedCat => {
          if (!categoryNames.has(predefinedCat.name)) {
            mergedCategories.push(predefinedCat);
          }
        });
        
        finalCategories = mergedCategories;
        // --- END CATEGORY LOGIC ---

        if (parsedData.transactions) {
          // Ordina le transazioni per data, dalla più recente
          parsedData.transactions.sort((a, b) => b.timestamp - a.timestamp);
          setTransactions(parsedData.transactions);
          loadedTransactions = parsedData.transactions;
        }
        if (parsedData.accounts) {
          loadedAccounts = parsedData.accounts;
        }
        if (parsedData.recurringTransactions) {
          setRecurringTransactions(parsedData.recurringTransactions);
          loadedRecurring = parsedData.recurringTransactions;
        }
        if (parsedData.budgets) {
          setBudgets(parsedData.budgets);
        }
        // Controlla esplicitamente la proprietà per caricare correttamente anche il valore 'false'
        if (parsedData.hasOwnProperty('calendarSyncEnabled')) {
          setIsCalendarSyncEnabled(parsedData.calendarSyncEnabled);
        }
      } else {
        // No stored data, use predefined categories
        finalCategories = predefined_categories;
      }

      // Assicura che il conto Contanti esista sempre
      if (!loadedAccounts.find(acc => acc.id === CASH_ACCOUNT_ID)) {
        loadedAccounts.unshift(CASH_ACCOUNT);
      }
      setAccounts(loadedAccounts);
      setCategories(finalCategories);

      // Imposta il primo conto come predefinito se non ce n'è uno selezionato
      if (loadedAccounts.length > 0 && !accountId) {
        setAccountId(getDefaultAccountId(loadedAccounts));
      }
      return { loadedTransactions, loadedRecurring, loadedAccounts };
    } catch (e) {
      console.error("Errore nel caricamento dei dati da Async Storage:", e);
      showCustomAlert("Errore", "Si è verificato un problema nel caricamento dei dati.", () => setIsAlertVisible(false));
      return { loadedTransactions: [], loadedRecurring: [], loadedAccounts: [] };
    }
  };

  // Salva i dati in Async Storage
  const saveData = async (newTransactions, newAccounts, newRecurringTransactions, newCategories, newBudgets, calendarSyncState) => {
    try {
      const dataToSave = {
        transactions: newTransactions || transactions,
        accounts: newAccounts || accounts,
        recurringTransactions: newRecurringTransactions !== undefined ? newRecurringTransactions : recurringTransactions,
        categories: newCategories || categories,
        budgets: newBudgets || budgets,
        calendarSyncEnabled: calendarSyncState !== undefined ? calendarSyncState : isCalendarSyncEnabled,
      };
      await AsyncStorage.setItem('financeData', JSON.stringify(dataToSave));
      if (newTransactions) setTransactions(newTransactions);
      if (newAccounts) setAccounts(newAccounts);
      if (newRecurringTransactions !== undefined) setRecurringTransactions(newRecurringTransactions);
      if (newCategories) setCategories(newCategories);
      if (newBudgets) setBudgets(newBudgets);
      if (calendarSyncState !== undefined) setIsCalendarSyncEnabled(calendarSyncState);
    } catch (e) {
      console.error("Errore nel salvataggio dei dati in Async Storage:", e);
      showCustomAlert("Errore", "Si è verificato un problema nel salvataggio dei dati.", () => setIsAlertVisible(false));
    }
  };

  // Ottiene le informazioni dell'utente dopo il login
  const fetchUserInfo = async (authentication) => {
    const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${authentication.accessToken}` },
    });
    const user = await response.json();
    setUserInfo({ ...user, ...authentication }); // Salva sia i dati utente che l'oggetto di autenticazione
  };

  // Controlla lo stato del login all'avvio
  const checkLoginStatus = async () => {
    try {
      const storedAuth = await AsyncStorage.getItem('googleAuth');
      if (!storedAuth) return;

      let auth = JSON.parse(storedAuth);

      // Controlla se il token è scaduto (con un buffer di 1 minuto)
      const expirationTime = (auth.issuedAt + auth.expiresIn) * 1000;
      if (Date.now() >= expirationTime - 60000) {
        if (auth.refreshToken) {
          const newAuth = await refreshAsync({
            clientId: '273919129646-igop9vk2e00j39rcnmobacsqi3r0ajb7.apps.googleusercontent.com',
            refreshToken: auth.refreshToken,
          }, discovery);

          const mergedAuth = { ...newAuth, refreshToken: newAuth.refreshToken || auth.refreshToken, scopes: newAuth.scopes || auth.scopes };
          await AsyncStorage.setItem('googleAuth', JSON.stringify(mergedAuth));
          auth = mergedAuth;
        } else {
          await AsyncStorage.removeItem('googleAuth');
          return;
        }
      }

      if (auth.accessToken) {
        fetchUserInfo(auth); // Passa l'oggetto intero
      }
    } catch (error) {
      console.error("Errore durante il controllo dello stato di login:", error);
      await AsyncStorage.removeItem('googleAuth');
    }
  };
  const getNextDueDate = (currentDueDate, frequency, interval) => {
    const date = new Date(currentDueDate);
    const numericInterval = parseInt(interval, 10);
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + numericInterval);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7 * numericInterval);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + numericInterval);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + numericInterval);
        break;
      default:
        break;
    }
    return date.getTime();
  };

  const processRecurringTransactions = async (currentTransactions, currentRecurring, currentAccounts) => {
    const now = Date.now();
    let newTransactions = [];
    let hasChanges = false;

    const updatedRecurring = currentRecurring.map(template => {
      let newTemplate = { ...template }; // Create a mutable copy
      while (newTemplate.generatedCount < newTemplate.count && newTemplate.nextDueDate <= now) {
        hasChanges = true;
        const newTransaction = {
          id: `${template.id}-${newTemplate.generatedCount}`,
          amount: newTemplate.amount,
          description: `${newTemplate.description} (${newTemplate.generatedCount + 1}/${newTemplate.count})`,
          category: newTemplate.category,
          subcategory: newTemplate.subcategory,
          type: newTemplate.type,
          accountId: newTemplate.accountId,
          timestamp: newTemplate.nextDueDate,
          isRecurring: true,
          recurringTemplateId: template.id,
        };
        newTransactions.push(newTransaction); // We'll sync them later in a batch
        newTemplate.generatedCount += 1;
        newTemplate.nextDueDate = getNextDueDate(newTemplate.nextDueDate, newTemplate.frequency, newTemplate.interval);
      }
      return newTemplate;
    });

    if (hasChanges) {
      // Sync all new transactions to calendar
      const syncedNewTransactions = [];
      for (const t of newTransactions) {
        const eventId = await syncTransactionToCalendar(t);
        syncedNewTransactions.push({ ...t, calendarEventId: eventId });
      }

      const allTransactions = [...currentTransactions, ...newTransactions].sort((a, b) => b.timestamp - a.timestamp);
      const finalRecurring = updatedRecurring.filter(t => t.generatedCount < t.count);
      await saveData(allTransactions, currentAccounts, finalRecurring);
    }
  };

  // --- GOOGLE CALENDAR SYNC ---

  const syncTransactionToCalendar = async (transaction) => {
    if (!isCalendarSyncEnabled || !userInfo?.accessToken) {
      return transaction.calendarEventId || null;
    }

    const event = {
      summary: `${transaction.type === 'expense' ? 'Spesa' : 'Entrata'}: ${formatCurrency(transaction.amount)} - ${transaction.description}`,
      description: `Categoria: ${transaction.category}${transaction.subcategory ? ` (${transaction.subcategory})` : ''}\nConto: ${accounts.find(a => a.id === transaction.accountId)?.bank || 'N/A'}`,
      start: { dateTime: new Date(transaction.timestamp).toISOString() },
      end: { dateTime: new Date(transaction.timestamp).toISOString() },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
      visibility: 'private',
    };

    const calendarId = 'primary';
    const eventId = transaction.calendarEventId;
    const url = eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const method = eventId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${userInfo.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        const result = await response.json();
        return result.id;
      } else if (response.status === 404 && eventId) {
        return syncTransactionToCalendar({ ...transaction, calendarEventId: null });
      } else {
        const error = await response.json();
        console.error(`Failed to ${method} calendar event:`, error);
        let userMessage = `Sincronizzazione fallita: ${error.error.message}`;
        if (response.status === 403) {
            userMessage = "Errore di permessi. Assicurati che l'API di Google Calendar sia abilitata nel tuo progetto Google Cloud e di aver concesso i permessi necessari.";
        } else if (response.status === 401) {
            userMessage = "Token di autenticazione non valido o scaduto. Prova a fare nuovamente il login.";
        }
        showCustomAlert("Errore Calendario", userMessage, () => setIsAlertVisible(false));
        return eventId;
      }
    } catch (error) {
      console.error(`Error ${method}ing calendar event:`, error);
      return eventId;
    }
  };

  const deleteCalendarEvent = async (eventId) => {
    if (!isCalendarSyncEnabled || !userInfo?.accessToken || !eventId) return;
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userInfo.accessToken}` },
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
    }
  };
  // Funzione per gestire l'aggiunta o la modifica di una transazione
  const handleAddOrUpdateTransaction = async (type) => {
    if (isRecurring) {
      handleSaveRecurringTransaction(type);
      return;
    }

    if (!amount || !description || !accountId) {
      showCustomAlert("Errore", "Per favore, inserisci tutti i campi (importo, descrizione e conto).", () => setIsAlertVisible(false));
      return;
    }

    // Gestione speciale per i prelievi (solo in creazione)
    if (type === 'expense' && category === 'Prelievo' && !editingId) {
      if (accountId === CASH_ACCOUNT_ID) {
        showCustomAlert("Operazione non valida", "Non è possibile prelevare contanti dal conto Contanti.", () => setIsAlertVisible(false));
        return;
      }

      const expenseId = `w-${Date.now()}`;
      const withdrawalExpense = {
        id: expenseId,
        amount: parseFloat(amount),
        description,
        category,
        subcategory,
        type: 'expense',
        accountId,
        timestamp: transactionDate.getTime(),
      };
      const cashIncome = {
        id: `${expenseId}-c`,
        amount: parseFloat(amount),
        description: `Prelievo da ${accounts.find(a => a.id === accountId)?.bank || 'conto'}`,
        category: 'Trasferimento',
        subcategory: '',
        type: 'income',
        accountId: CASH_ACCOUNT_ID,
        timestamp: transactionDate.getTime(),
      };

      const eventId1 = await syncTransactionToCalendar(withdrawalExpense);
      const eventId2 = await syncTransactionToCalendar(cashIncome);

      const updatedTransactions = [
        { ...withdrawalExpense, calendarEventId: eventId1 },
        { ...cashIncome, calendarEventId: eventId2 },
        ...transactions
      ].sort((a, b) => b.timestamp - a.timestamp);
      saveData(updatedTransactions);
      showCustomAlert("Prelievo Registrato", "La spesa e l'entrata in contanti sono state registrate.", () => setIsAlertVisible(false));
    } else {
      // Logica standard per tutte le altre transazioni (incluse le modifiche)
    const baseTransaction = {
      id: editingId || Date.now().toString(),
      amount: parseFloat(amount),
      description: description,
      category: category,
      subcategory: subcategory,
      type: type, // 'expense' o 'income'
      accountId: accountId, // Aggiungi l'ID del conto
      timestamp: transactionDate.getTime(),
      calendarEventId: editingId ? transactions.find(t => t.id === editingId)?.calendarEventId : null,
    };

    const eventId = await syncTransactionToCalendar(baseTransaction);
    const newTransaction = { ...baseTransaction, calendarEventId: eventId };
    let updatedTransactions;
    if (editingId) {
      // Modifica la transazione esistente
      updatedTransactions = transactions.map(t => t.id === editingId ? newTransaction : t);
      showCustomAlert("Transazione aggiornata", "La transazione è stata aggiornata con successo.", () => setIsAlertVisible(false));
    } else {
      updatedTransactions = [newTransaction, ...transactions].sort((a, b) => b.timestamp - a.timestamp);
      showCustomAlert("Transazione aggiunta", "La transazione è stata aggiunta con successo.", () => setIsAlertVisible(false));
    }
    saveData(updatedTransactions);
    }

    // Resetta i campi e torna alla dashboard
    setAmount('');
    setDescription('');
    setCategory(categories.length > 0 ? categories[0].name : 'Altro');
    setSubcategory('');
    setEditingId(null);
    setTransactionDate(new Date());
    setIsRecurring(false);
    setAccountId(getDefaultAccountId(accounts));
    setView('dashboard');

  };

  const handleSaveRecurringTransaction = async (type) => { // Handles both create and update
    const interval = parseInt(recurrenceInterval, 10);
    const count = parseInt(recurrenceCount, 10);

    if (!amount || !description || !accountId) {
      showCustomAlert("Errore", "Per favore, inserisci tutti i campi (importo, descrizione e conto).", () => setIsAlertVisible(false));
      return;
    }
    if (isNaN(interval) || interval <= 0 || isNaN(count) || count <= 0) {
      showCustomAlert("Errore", "Intervallo e numero di ripetizioni devono essere numeri positivi.", () => setIsAlertVisible(false));
      return;
    }

    const newRecurringTemplate = {
      id: Date.now().toString(),
      amount: parseFloat(amount),
      description: description,
      category: category,
      subcategory: subcategory,
      type: type,
      accountId: accountId,
      startDate: transactionDate.getTime(),
      frequency: recurrenceFrequency,
      interval: interval,
      count: count,
      generatedCount: 0,
      nextDueDate: transactionDate.getTime(),
    };

    const updatedRecurring = [...recurringTransactions, newRecurringTemplate];
    // Resetta il form prima di processare, così l'utente vede subito il risultato
    setAmount(''); setDescription(''); setCategory('Altro'); setEditingId(null);
    setTransactionDate(new Date()); setIsRecurring(false); setRecurrenceFrequency('monthly');
    setRecurrenceInterval('1'); setRecurrenceCount('12'); setAccountId(getDefaultAccountId(accounts)); setSubcategory('');
    await processRecurringTransactions(transactions, updatedRecurring, accounts);
    showCustomAlert("Transazione Ricorrente Aggiunta", "La serie di transazioni ricorrenti è stata creata.", () => {
      setIsAlertVisible(false);
      setView('dashboard');
    });
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const newDate = new Date(selectedDate);
      const currentTime = new Date(transactionDate);
      newDate.setHours(currentTime.getHours());
      newDate.setMinutes(currentTime.getMinutes());
      newDate.setSeconds(currentTime.getSeconds());
      setTransactionDate(newDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selectedTime) {
      const newTime = new Date(selectedTime);
      const currentDate = new Date(transactionDate);
      currentDate.setHours(newTime.getHours());
      currentDate.setMinutes(newTime.getMinutes());
      setTransactionDate(currentDate);
    }
  };
  // Gestisce l'eliminazione di una transazione
  const handleDeleteTransaction = async (id) => {
    showCustomAlert(
      "Conferma",
      "Sei sicuro di voler eliminare questa transazione?",
      async () => {
        const transactionToDelete = transactions.find(t => t.id === id);
        if (transactionToDelete?.calendarEventId) {
          await deleteCalendarEvent(transactionToDelete.calendarEventId);
        }
        const updatedTransactions = transactions.filter(t => t.id !== id);
        saveData(updatedTransactions);
        showCustomAlert("Eliminata", "La transazione è stata eliminata.", () => setIsAlertVisible(false));
      },
      () => setIsAlertVisible(false),
      true // Mostra il pulsante "Annulla"
    );
  };

  // Prepara il form per la modifica
  const handleEditTransaction = (transaction) => {
    if (transaction.isRecurring) {
      showCustomAlert("Info", "Le transazioni generate da una serie ricorrente non possono essere modificate singolarmente.", () => setIsAlertVisible(false));
      return;
    }
    setEditingId(transaction.id);
    setAmount(transaction.amount.toString());
    setDescription(transaction.description);
    setCategory(transaction.category);
    setSubcategory(transaction.subcategory || '');
    setAccountId(transaction.accountId);
    setTransactionDate(new Date(transaction.timestamp));
    if (transaction.type === 'expense') {
      setView('addExpense');
    } else {
      setView('addIncome');
    }
  };

  // Funzione per gestire l'aggiunta o la modifica di un conto
  const handleAddOrUpdateAccount = () => {
    if (!accountBank || !accountNumber || !accountDescription) {
      showCustomAlert("Errore", "Per favore, compila tutti i campi.", () => setIsAlertVisible(false));
      return;
    }

    let updatedAccounts;
    if (editingAccountId) {
      updatedAccounts = accounts.map(acc => acc.id === editingAccountId ? {
        ...acc,
        bank: accountBank,
        number: accountNumber,
        description: accountDescription
      } : acc);
    } else {
      const newAccount = {
        id: `acc-${Date.now()}`,
        bank: accountBank,
        number: accountNumber,
        description: accountDescription,
      };
      updatedAccounts = [...accounts, newAccount];
    }
    saveData(null, updatedAccounts);
    setAccountBank('');
    setAccountNumber('');
    setAccountDescription('');
    setEditingAccountId(null);
    showCustomAlert("Successo", "Il conto è stato salvato.", () => setIsAlertVisible(false));
  };
  
  // Funzione per eliminare un conto
  const handleDeleteAccount = async (id) => {
    showCustomAlert(
      "Conferma",
      "Eliminare questo conto eliminerà anche tutte le transazioni e le serie ricorrenti ad esso associate. Continuare?",
      async () => {
        const transactionsToDelete = transactions.filter(t => t.accountId === id);
        if (isCalendarSyncEnabled && userInfo?.accessToken) {
          for (const t of transactionsToDelete) {
            if (t.calendarEventId) {
              await deleteCalendarEvent(t.calendarEventId);
            }
          }
        }
        const updatedAccounts = accounts.filter(acc => acc.id !== id);
        const updatedTransactions = transactions.filter(t => t.accountId !== id);
        const updatedRecurring = recurringTransactions.filter(t => t.accountId !== id);
        saveData(updatedTransactions, updatedAccounts, updatedRecurring);
        showCustomAlert("Conto eliminato", "Il conto e le relative transazioni sono stati eliminati.", () => setIsAlertVisible(false));
      },
      () => setIsAlertVisible(false),
      true
    );
  };
  
  // Funzione per resettare tutti i dati
  const handleResetData = () => {
    showCustomAlert(
      "Attenzione!",
      "Questa operazione cancellerà tutte le transazioni e i conti salvati. Non sarà possibile annullare. Sei sicuro di voler procedere?",
      () => {
        setTransactions([]);
        setAccounts([CASH_ACCOUNT]);
        setRecurringTransactions([]);
        setCategories(predefined_categories);
        AsyncStorage.clear();
        showCustomAlert("Dati resettati", "Tutti i dati sono stati cancellati. Puoi iniziare da zero.", () => {
          setIsAlertVisible(false);
          setView('dashboard');
        });
      },
      () => setIsAlertVisible(false),
      true
    );
  };

  // Funzioni per la gestione delle categorie
  const handleAddOrUpdateCategory = () => {
    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      showCustomAlert("Errore", "Il nome della categoria non può essere vuoto.", () => setIsAlertVisible(false));
      return;
    }
    // Controlla duplicati (case-insensitive), ma permette di salvare lo stesso nome durante la modifica
    if (categories.map(c => c.name.toLowerCase()).includes(trimmedName.toLowerCase()) && trimmedName.toLowerCase() !== editingCategoryName?.toLowerCase()) {
      showCustomAlert("Errore", "Questa categoria esiste già.", () => setIsAlertVisible(false));
      return;
    }

    let updatedCategories;
    if (editingCategoryName) {
      // Modifica
      const updatedTransactions = transactions.map(t => {
        if (t.category === editingCategoryName) {
          return { ...t, category: trimmedName, subcategory: '' }; // Resetta la sottocategoria quando la categoria principale cambia
        }
        return t;
      });
      updatedCategories = categories.map(c => (c.name === editingCategoryName ? { ...c, name: trimmedName } : c));
      saveData(updatedTransactions, null, null, updatedCategories);
      showCustomAlert("Successo", "Categoria aggiornata con successo.", () => setIsAlertVisible(false));
    } else {
      // Aggiungi
      updatedCategories = [...categories, { name: trimmedName, subcategories: [] }];
      saveData(null, null, null, updatedCategories);
      showCustomAlert("Successo", "Categoria aggiunta con successo.", () => setIsAlertVisible(false));
    }
    setCategoryName('');
    setEditingCategoryName(null);
  };

  const handleEditCategory = (name) => {
    setEditingCategoryName(name);
    setCategoryName(name);
    if (categoryScrollViewRef.current) {
      categoryScrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
    if (categoryInputRef.current) {
      setTimeout(() => categoryInputRef.current.focus(), 100);
    }
  };

  const handleDeleteCategory = (name) => {
    if (name === 'Altro') {
      showCustomAlert("Impossibile", "La categoria 'Altro' non può essere eliminata.", () => setIsAlertVisible(false));
      return;
    }

    showCustomAlert(
      "Conferma Eliminazione",
      `Sei sicuro di voler eliminare la categoria "${name}"? Tutte le transazioni associate verranno spostate nella categoria "Altro".`,
      () => {
        const updatedTransactions = transactions.map(t => (t.category === name ? { ...t, category: 'Altro', subcategory: '' } : t));
        const updatedCategories = categories.filter(c => c.name !== name);
        saveData(updatedTransactions, null, null, updatedCategories);
        showCustomAlert("Eliminata", `La categoria "${name}" è stata eliminata.`, () => setIsAlertVisible(false));
      },
      () => setIsAlertVisible(false),
      true
    );
  };

  // Funzioni per la gestione delle sottocategorie
  const handleAddOrUpdateSubcategory = () => {
    const trimmedName = subcategoryName.trim();
    if (!trimmedName || !selectedCategoryForSubcat) {
      showCustomAlert("Errore", "Il nome della sottocategoria non può essere vuoto.", () => setIsAlertVisible(false));
      return;
    }

    const mainCategory = categories.find(c => c.name === selectedCategoryForSubcat.name);
    if (!mainCategory) return;

    // Controlla duplicati (case-insensitive)
    if (mainCategory.subcategories.map(s => s.toLowerCase()).includes(trimmedName.toLowerCase()) && trimmedName.toLowerCase() !== editingSubcategoryName?.toLowerCase()) {
      showCustomAlert("Errore", "Questa sottocategoria esiste già.", () => setIsAlertVisible(false));
      return;
    }

    let updatedCategories;
    if (editingSubcategoryName) {
      // Modifica sottocategoria
      const updatedSubcategories = mainCategory.subcategories.map(s => s === editingSubcategoryName ? trimmedName : s);
      updatedCategories = categories.map(c => c.name === mainCategory.name ? { ...c, subcategories: updatedSubcategories } : c);
      
      const updatedTransactions = transactions.map(t => {
        if (t.category === mainCategory.name && t.subcategory === editingSubcategoryName) {
          return { ...t, subcategory: trimmedName };
        }
        return t;
      });
      saveData(updatedTransactions, null, null, updatedCategories);
      showCustomAlert("Successo", "Sottocategoria aggiornata.", () => setIsAlertVisible(false));
    } else {
      // Aggiungi nuova sottocategoria
      const updatedSubcategories = [...mainCategory.subcategories, trimmedName];
      updatedCategories = categories.map(c => c.name === mainCategory.name ? { ...c, subcategories: updatedSubcategories } : c);
      saveData(null, null, null, updatedCategories);
      showCustomAlert("Successo", "Sottocategoria aggiunta.", () => setIsAlertVisible(false));
    }

    setSubcategoryName('');
    setEditingSubcategoryName(null);
  };

  const handleEditSubcategory = (name) => {
    setEditingSubcategoryName(name);
    setSubcategoryName(name);
  };

  const handleDeleteSubcategory = (subcatNameToDelete) => {
    if (!selectedCategoryForSubcat) return;

    showCustomAlert(
      "Conferma Eliminazione",
      `Sei sicuro di voler eliminare la sottocategoria "${subcatNameToDelete}"? Verrà rimossa da tutte le transazioni associate.`,
      () => {
        const mainCategory = categories.find(c => c.name === selectedCategoryForSubcat.name);
        if (!mainCategory) return;

        const updatedSubcategories = mainCategory.subcategories.filter(s => s !== subcatNameToDelete);
        const updatedCategories = categories.map(c => c.name === mainCategory.name ? { ...c, subcategories: updatedSubcategories } : c);
        
        const updatedTransactions = transactions.map(t => (t.category === mainCategory.name && t.subcategory === subcatNameToDelete) ? { ...t, subcategory: '' } : t);

        saveData(updatedTransactions, null, null, updatedCategories);
        showCustomAlert("Eliminata", `La sottocategoria "${subcatNameToDelete}" è stata eliminata.`, () => setIsAlertVisible(false));
      },
      () => setIsAlertVisible(false),
      true
    );
  };

  // Funzione per salvare i budget
  const handleSaveBudgets = () => {
    const sanitizedBudgets = {
      total: parseFloat(String(tempBudgets.total || '0').replace(',', '.')) || 0,
      categories: {},
    };

    for (const catName in tempBudgets.categories) {
      if (Object.prototype.hasOwnProperty.call(tempBudgets.categories, catName)) {
        sanitizedBudgets.categories[catName] = parseFloat(String(tempBudgets.categories[catName] || '0').replace(',', '.')) || 0;
      }
    }

    saveData(null, null, null, null, sanitizedBudgets);
    showCustomAlert("Successo", "I budget sono stati salvati.", () => {
      setIsAlertVisible(false); setView('configuration');
    }
    );
  };

  const downloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const storedData = await AsyncStorage.getItem('financeData');
      if (!storedData) {
        showCustomAlert("Nessun Dato", "Non ci sono dati da salvare.", () => setIsAlertVisible(false));
        return;
      }

      const fileName = `ExpenseTracker_Backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, storedData, { encoding: FileSystem.EncodingType.UTF8 });

      if (!(await Sharing.isAvailableAsync())) {
        showCustomAlert("Errore", "La condivisione non è disponibile su questo dispositivo.", () => setIsAlertVisible(false));
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Salva il tuo backup locale',
        UTI: 'public.json', // Per iOS
      });
    } catch (error) {
      console.error("Errore durante il download del backup:", error);
      showCustomAlert("Errore", `Si è verificato un problema durante il salvataggio del backup: ${error.message}`, () => setIsAlertVisible(false));
    } finally {
      setIsBackingUp(false);
    }
  };

  const toggleCalendarSync = async (value) => {
    if (value && !userInfo) {
      showCustomAlert(
        "Autenticazione Richiesta",
        "Per favore, effettua il login con Google per abilitare la sincronizzazione del calendario.",
        () => promptAsync()
      );
      return;
    }
    setIsCalendarSyncEnabled(value);
    await saveData(null, null, null, null, null, value);
  };

  const handleManualCalendarSync = async () => {
    if (!isCalendarSyncEnabled || !userInfo) {
      showCustomAlert("Errore", "La sincronizzazione del calendario non è abilitata o non sei loggato.", () => setIsAlertVisible(false));
      return;
    }

    showCustomAlert(
      "Conferma Sincronizzazione",
      "Questo aggiungerà tutte le transazioni passate non sincronizzate al tuo calendario. Potrebbe richiedere del tempo. Continuare?",
      async () => {
        setIsBackingUp(true); // Reuse backup spinner
        let updatedTransactions = [...transactions];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < updatedTransactions.length; i++) {
          if (!updatedTransactions[i].calendarEventId) {
            const eventId = await syncTransactionToCalendar(updatedTransactions[i]);
            if (eventId) {
              updatedTransactions[i].calendarEventId = eventId;
              successCount++;
            } else {
              errorCount++;
            }
          }
        }

        if (successCount > 0 || errorCount > 0) {
          await saveData(updatedTransactions);
          showCustomAlert("Sincronizzazione Completata", `${successCount} transazioni sincronizzate. ${errorCount > 0 ? `${errorCount} errori.` : ''}`, () => setIsAlertVisible(false));
        } else {
          showCustomAlert("Nessuna Novità", "Tutte le transazioni erano già sincronizzate.", () => setIsAlertVisible(false));
        }
        setIsBackingUp(false);
      },
      () => setIsAlertVisible(false),
      true
    );
  };

  // Funzione per gestire l'input e filtrare i suggerimenti
  const handleBankInputChange = (text) => {
    setAccountBank(text);
    if (text.length > 0) {
      const filtered = predefined_banks.filter(bank =>
        bank.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredBanks(filtered);
    } else {
      setFilteredBanks(predefined_banks);
    }
  };

  // Funzione di Backup su Google Drive
  const backupData = async () => {
    if (!userInfo) {
      showCustomAlert("Autenticazione Richiesta", "Per favore, autenticati con Google per continuare.", () => promptAsync());
      return;
    }

    setIsBackingUp(true);
    try {
      const storedData = await AsyncStorage.getItem('financeData');
      if (!storedData) {
        showCustomAlert("Nessun Dato", "Non ci sono dati da salvare.", () => setIsAlertVisible(false));
        return;
      }

      const fileName = `ExpenseTracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileContent = storedData;
      const accessToken = userInfo.accessToken;

      const metadata = {
        name: fileName,
        parents: ['appDataFolder'], // Salva nella cartella dati dell'app, non visibile all'utente
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
      const filePart = `Content-Type: application/json\r\n\r\n${fileContent}`;

      const multipartRequestBody =
        delimiter +
        metadataPart +
        delimiter +
        filePart +
        close_delim;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody,
      });

      if (res.ok) {
        showCustomAlert("Backup Completato", `I tuoi dati sono stati salvati su Google Drive come "${fileName}".`, () => setIsAlertVisible(false));
      } else {
        const error = await res.json();
        console.error("Google Drive Backup Error:", error);
        showCustomAlert("Errore di Backup", `Impossibile salvare su Google Drive. Dettagli: ${error.error.message}`, () => setIsAlertVisible(false));
      }
    } catch (error) {
      console.error("Errore durante il backup:", error);
      showCustomAlert("Errore", "Si è verificato un problema durante il backup.", () => setIsAlertVisible(false));
    } finally {
      setIsBackingUp(false);
    }
  };

  // Funzione di Ripristino da Google Drive
  const restoreData = async () => {
    if (!userInfo) {
      showCustomAlert("Autenticazione Richiesta", "Per favore, autenticati con Google per continuare.", () => promptAsync());
      return;
    }

    setIsRestoring(true);
    try {
      const accessToken = userInfo.accessToken;
      const listRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime)&orderBy=createdTime desc', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listRes.ok) throw new Error('Impossibile elencare i file.');
      const { files } = await listRes.json();

      if (files.length === 0) {
        showCustomAlert("Nessun Backup", "Nessun file di backup trovato su Google Drive.", () => setIsAlertVisible(false));
        setIsRestoring(false);
        return;
      }

      let ExpenseTrackerFiles = files.filter(function (el) {
        return el.name.toLowerCase().indexOf("expensetracker_backup") > -1;
      });

      const latestBackup = ExpenseTrackerFiles[0];
      moment.locale('it');

      showCustomAlert(
        "Conferma Ripristino",
        `Vuoi ripristinare i dati dal backup "${latestBackup.name}" creato il ${moment(latestBackup.createdTime).format('d MMMM yyyy')} alle ${moment(latestBackup.createdTime).format('HH:mm')} ? L'operazione sovrascriverà i dati attuali.`,
        async () => {
          try {
            const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${latestBackup.id}?alt=media`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!fileRes.ok) throw new Error('Impossibile scaricare il file.');
            const backupDataString = await fileRes.text();
            const parsedData = JSON.parse(backupDataString);
            let restoredAccounts = parsedData.accounts || [];
            // Assicura che il conto Contanti esista sempre dopo il ripristino
            if (!restoredAccounts.find(acc => acc.id === CASH_ACCOUNT_ID)) {
              restoredAccounts.unshift(CASH_ACCOUNT);
            }
            await saveData(parsedData.transactions, restoredAccounts, parsedData.recurringTransactions, parsedData.categories || predefined_categories);
            showCustomAlert("Ripristino Completato", "I dati sono stati ripristinati con successo. Ricarica l'app per vedere le modifiche.", () => setIsAlertVisible(false));
          } catch (e) {
            console.error("Errore durante il ripristino:", e);
            showCustomAlert("Errore di Ripristino", "Impossibile ripristinare i dati.", () => setIsAlertVisible(false));
          } finally {
            setIsRestoring(false);
          }
        },
        () => { setIsRestoring(false); setIsAlertVisible(false); },
        true
      );
    } catch (error) {
      console.error("Errore durante il ripristino:", error);
      showCustomAlert("Errore", "Si è verificato un problema durante il ripristino.", () => setIsAlertVisible(false));
      setIsRestoring(false);
    }
  };

  const handleLogout = async () => {
    if (userInfo?.accessToken) {
      try {
        await revokeAsync({
          token: userInfo.accessToken,
          clientId: '273919129646-igop9vk2e00j39rcnmobacsqi3r0ajb7.apps.googleusercontent.com',
        }, discovery);
      } catch (error) {
        console.error("Errore durante la revoca del token:", error);
      }
    }
    await AsyncStorage.removeItem('googleAuth');
    setUserInfo(null);
  };

  // Carica i dati all'avvio del componente
  useEffect(() => {
    const initAndProcess = async () => {
      try {
        await checkLoginStatus();
        const { loadedTransactions, loadedRecurring, loadedAccounts } = await loadData(); // This now also loads categories
      await processRecurringTransactions(loadedTransactions, loadedRecurring, loadedAccounts);
      } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
        showCustomAlert("Errore Critico", "Impossibile avviare l'app. Prova a riavviare.", () => {});
      }
    };
    initAndProcess();
  }, []);

  const chartConfig = {
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  const ChartContainer = ({ screenWidth, pieChartData, centerTitle, centerAmount, centerAmountColor }) => {
    if (!pieChartData || pieChartData.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.emptyText}>Nessun dato da mostrare nel grafico.</Text>
        </View>
      );
    }

    const chartContentWidth = screenWidth;
    const chartDiameter = 220; // from height

    return (
      <View style={styles.chartContainer} alignItems="center" justifyContent="center">
        <PieChart
          marginLeft={'auto'}
          marginRight={'auto'}
          left={0}
          right={0}
          top={0}
          bottom={0}
          data={pieChartData}
          width={chartDiameter}
          height={chartDiameter}
          center={[55,0]}
          chartConfig={chartConfig}
          accessor={"amount"}
          backgroundColor={"transparent"}
          paddingLeft={0}
          absolute
          hasLegend={false}
        />
        <View style={styles.chartCenterLabel}>
          <Text style={styles.cardTitle}>{centerTitle}</Text>
          <Text
            style={[styles.cardAmount, { color: centerAmountColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
          >
            {formatCurrency(centerAmount)}
          </Text>
        </View>
      </View>
    );
  };

  const BudgetProgressBar = ({ spent, total, label }) => {
    if (!total || total <= 0) {
      return null;
    }
    const percentage = Math.min((spent / total) * 100, 100);
    const barColor = percentage > 100 ? Colors.red : (percentage > 80 ? '#f59e0b' : Colors.secondary);

    return (
      <View style={styles.budgetBarContainer}>
        <View style={styles.budgetBarLabels}>
          <Text style={styles.budgetBarLabel}>{label}</Text>
          <Text style={styles.budgetBarAmount}>{formatCurrency(spent)} / {formatCurrency(total)}</Text>
        </View>
        <View style={styles.budgetBarBackground}>
          <View style={[styles.budgetBarFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    );
  };

  const LegendItemWithBudget = ({ item }) => {
    const categoryBudget = budgets.categories[item.name] || 0;

    return (
      <View style={styles.legendItemContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
          <Text style={styles.legendText} numberOfLines={1} ellipsizeMode="tail">
            {item.name}: {formatCurrency(item.amount)}
          </Text>
        </View>
        {filterPeriod === 'month' && categoryBudget > 0 && (
          <BudgetProgressBar spent={item.amount} total={categoryBudget} label={`${((item.amount / categoryBudget) * 100).toFixed(1)}%`} />
        )}
      </View>
    );
  };

  const renderChartLegend = (data) => (
    <View style={styles.legendContainer}>
      {data.map((item, index) => <LegendItemWithBudget key={index} item={item} />)}
    </View>
  );
  // Filtra le transazioni in base al periodo e al conto selezionato
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.timestamp);
    const isPeriodMatch = () => {
      if (filterPeriod === 'month') {
        return transactionDate.getFullYear() === selectedYear && (transactionDate.getMonth() + 1) === selectedMonth;
      }
      if (filterPeriod === 'year') {
        return transactionDate.getFullYear() === selectedYear;
      }
      return true;
    };
    const isAccountMatch = () => {
      return selectedAccountId === 'all' || t.accountId === selectedAccountId;
    };
    return isPeriodMatch() && isAccountMatch();
  });

  // Calcola i totali per la dashboard
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = totalIncome - totalExpenses;
  
  // Calcola i totali per categoria per il grafico a torta
  const expensesByCategory = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    const cat = t.category || 'Altro';
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {});

  const pieChartData = Object.keys(expensesByCategory).map((category, index) => {
    return {
      name: category,
      amount: expensesByCategory[category],
      color: Colors.chartColors[index % Colors.chartColors.length]
    };
  });

  // Calcola i totali per categoria per il grafico a torta delle entrate
  const incomeByCategory = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => {
    const cat = t.category || 'Altro';
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {});

  const incomePieChartData = Object.keys(incomeByCategory).map((category, index) => ({ name: category, amount: incomeByCategory[category], color: Colors.chartColors[index % Colors.chartColors.length] }));
  // Calcola i saldi per ogni conto
  const accountBalances = accounts.map(account => {
    const accountIncome = transactions.filter(t => t.type === 'income' && t.accountId === account.id).reduce((sum, t) => sum + t.amount, 0);
    const accountExpenses = transactions.filter(t => t.type === 'expense' && t.accountId === account.id).reduce((sum, t) => sum + t.amount, 0);
    return {
      ...account,
      balance: accountIncome - accountExpenses,
    };
  });

  const renderFilters = () => (
    <>
      {/* Selettore del conto */}
      <View style={styles.filterContainer}>
        <Text style={styles.pickerLabel}>Conto:</Text>
        <Picker
          selectedValue={selectedAccountId}
          onValueChange={(itemValue) => setSelectedAccountId(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Tutti i Conti" value="all" />
          {accounts.map(acc => (
            <Picker.Item key={acc.id} label={`${acc.bank} (${acc.description})`} value={acc.id} />
          ))}
        </Picker>
      </View>

      {/* Selettore del periodo */}
      <View style={styles.chartContainer}>
        <Text style={styles.listHeader}>Filtri Periodo</Text>
        <Picker
          selectedValue={filterPeriod}
          onValueChange={(itemValue) => setFilterPeriod(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Mese" value="month" />
          <Picker.Item label="Anno" value="year" />
        </Picker>
      </View>
      {filterPeriod === 'month' && (
        <View style={styles.subFilterContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedMonth}
              onValueChange={(itemValue) => setSelectedMonth(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {months.map((month, index) => (
                <Picker.Item key={index} label={month} value={index + 1} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedYear}
              onValueChange={(itemValue) => setSelectedYear(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {years.map((year) => (
                <Picker.Item key={year} label={year.toString()} value={year} />
              ))}
            </Picker>
          </View>
        </View>
      )}
      {filterPeriod === 'year' && (
        <View style={styles.subFilterContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedYear}
              onValueChange={(itemValue) => setSelectedYear(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {years.map((year) => (
                <Picker.Item key={year} label={year.toString()} value={year} />
              ))}
            </Picker>
          </View>
        </View>
      )}
    </>
  );

  const renderExpensesView = () => {
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');
    let filterText = '';
    if (filterPeriod === 'year') {
      filterText = `(${selectedYear})`;
    } else if (filterPeriod === 'month') {
      const monthName = months[selectedMonth - 1];
      filterText = `(${monthName} ${selectedYear})`;
    }

    return (
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.header}>Dettaglio Spese
          {filterText ? <Text style={styles.headerSubtitle}> {filterText}</Text> : null}
        </Text>
        
        <ChartContainer
          screenWidth={screenWidth - 40}
          pieChartData={pieChartData}
          centerTitle="Totale Spese"
          centerAmount={totalExpenses}
          centerAmountColor={Colors.red}
        />
        {renderFilters()}
        {pieChartData.length > 0 && renderChartLegend(pieChartData)}
        <View style={styles.recentTransactionsContainer}>
          <Text style={styles.listHeader}>Elenco Spese</Text>
          {expenseTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna spesa nel periodo selezionato.</Text>
          ) : (
            expenseTransactions.map((t) => (
              <View key={t.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{t.description}</Text>
                  <Text style={styles.transactionCategory}>
                    {accounts.find(acc => acc.id === t.accountId)?.bank} • {t.category}{t.subcategory ? ` (${t.subcategory})` : ''} • {new Date(t.timestamp).toLocaleDateString('it-IT')}
                  </Text>
                </View>
                <View style={styles.transactionButtons}>
                  <TouchableOpacity onPress={() => handleEditTransaction(t)}>
                    <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                    <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.transactionAmount, styles.expenseText]}>
                  -{formatCurrency(t.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
        <View style={styles.spacer} />
      </ScrollView>
    );
  };

  const renderIncomeView = () => {
    const incomeTransactions = filteredTransactions.filter(t => t.type === 'income');
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');
    let filterText = '';
    if (filterPeriod === 'year') {
      filterText = `(${selectedYear})`;
    } else if (filterPeriod === 'month') {
      const monthName = months[selectedMonth - 1];
      filterText = `(${monthName} ${selectedYear})`;
    }

    return (
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.header}>Dettaglio Entrate
          {filterText ? <Text style={styles.headerSubtitle}> {filterText}</Text> : null}
        </Text>
        <ChartContainer
          screenWidth={screenWidth - 40}
          pieChartData={incomePieChartData}
          centerTitle="Totale Entrate"
          centerAmount={totalIncome}
          centerAmountColor={Colors.secondary}
        />
        {renderFilters()}
        {incomePieChartData.length > 0 && renderChartLegend(incomePieChartData)}
        <View style={styles.recentTransactionsContainer}>
          <Text style={styles.listHeader}>Elenco Entrate</Text>
          {incomeTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna entrata nel periodo selezionato.</Text>
          ) : (
            incomeTransactions.map((t) => (
              <View key={t.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{t.description}</Text>
                  <Text style={styles.transactionCategory}>
                    {accounts.find(acc => acc.id === t.accountId)?.bank} • {t.category}{t.subcategory ? ` (${t.subcategory})` : ''} • {new Date(t.timestamp).toLocaleDateString('it-IT')}
                  </Text>
                </View>
                <View style={styles.transactionButtons}>
                  <TouchableOpacity onPress={() => handleEditTransaction(t)}>
                    <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                    <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.transactionAmount, styles.incomeText]}>
                  {formatCurrency(t.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
        <View style={styles.spacer} />
      </ScrollView>
    );
  };

  const renderBudgetView = () => {
    // Filtra le transazioni specificamente per la vista budget
    const budgetViewTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.timestamp);
      return transactionDate.getFullYear() === budgetSelectedYear && (transactionDate.getMonth() + 1) === budgetSelectedMonth;
    });

    const budgetViewTotalExpenses = budgetViewTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const budgetViewExpensesByCategory = budgetViewTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const cat = t.category || 'Altro';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
      }, {});

    return (
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.header}>Andamento Budget</Text>

        {/* Filtri dedicati per la vista Budget */}
        <View style={styles.subFilterContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={budgetSelectedMonth}
              onValueChange={(itemValue) => setBudgetSelectedMonth(itemValue)}
              style={styles.picker} itemStyle={styles.pickerItem}>
              {months.map((month, index) => (
                <Picker.Item key={index} label={month} value={index + 1} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={budgetSelectedYear}
              onValueChange={(itemValue) => setBudgetSelectedYear(itemValue)}
              style={styles.picker} itemStyle={styles.pickerItem}>
              {years.map((year) => (
                <Picker.Item key={year} label={year.toString()} value={year} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Progresso Budget Totale */}
        {budgets.total > 0 && (
          <View style={styles.recentTransactionsContainer}>
            <Text style={styles.listHeader}>Progresso Budget Totale Mensile</Text>
            <BudgetProgressBar spent={budgetViewTotalExpenses} total={budgets.total} label={`Speso: ${((budgetViewTotalExpenses / budgets.total) * 100).toFixed(1)}%`} />
          </View>
        )}

        {/* Dettaglio per Categoria */}
        <View style={styles.recentTransactionsContainer}>
          <Text style={styles.listHeader}>Dettaglio per Categoria</Text>
          {Object.keys(budgetViewExpensesByCategory).length === 0 ? (
            <Text style={styles.emptyText}>Nessuna spesa per questo mese.</Text>
          ) : (
            Object.entries(budgetViewExpensesByCategory).sort((a, b) => b[1] - a[1]).map(([category, spent]) => (
              <BudgetProgressBar key={category} spent={spent} total={budgets.categories[category] || 0} label={category} />
            ))
          )}
        </View>
      </ScrollView>
    );
  };
  const renderBalanceView = () => {
    let filterText = '';
    if (filterPeriod === 'year') {
      filterText = `(${selectedYear})`;
    } else if (filterPeriod === 'month') {
      const monthName = months[selectedMonth - 1];
      filterText = `(${monthName} ${selectedYear})`;
    }

    return (
      <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>Saldo
        {filterText ? <Text style={styles.headerSubtitle}> {filterText}</Text> : null}
      </Text>

      {/* Grafico a Torta delle Spese */}
      <ChartContainer screenWidth={screenWidth - 40} pieChartData={pieChartData} centerTitle="Saldo Totale" centerAmount={totalBalance} centerAmountColor={totalBalance >= 0 ? Colors.secondary : Colors.red} />
      {renderFilters()}
      {pieChartData.length > 0 && renderChartLegend(pieChartData)}

      {/* Progresso Budget Totale */}
      {filterPeriod === 'month' && budgets.total > 0 && (
        <View style={styles.recentTransactionsContainer}>
          <Text style={styles.listHeader}>Progresso Budget Mensile</Text>
          <BudgetProgressBar
            spent={totalExpenses}
            total={budgets.total}
            label={`Speso: ${((totalExpenses / budgets.total) * 100).toFixed(1)}%`} />
        </View>
      )}

      {/* Card dei Totali */}
      <View style={styles.totalsContainer}>
        <View style={[styles.dashboardCard, styles.incomeCard]}>
          <Text style={styles.cardTitle}>Entrate</Text>
          <Text
            style={[styles.cardAmount, styles.incomeText]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={[styles.dashboardCard, styles.expenseCard]}>
          <Text style={styles.cardTitle}>Uscite</Text>
          <Text style={[styles.cardAmount, styles.expenseText]} numberOfLines={1} adjustsFontSizeToFit={true}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
      </View>

      {/* Lista saldi per conto */}
      <View style={styles.recentTransactionsContainer}>
        <Text style={styles.listHeader}>Saldi per Conto</Text>
        {accountBalances.length > 0 ? (
          accountBalances.map(acc => (
            <View key={acc.id} style={styles.accountItem}>
              <View style={styles.accountIcon}>
                <MaterialCommunityIcons name={getBankIconName(acc.bank)} size={24} color={Colors.text} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountBank}>{acc.bank}</Text>
                <Text style={styles.accountNumber}>{acc.description}</Text>
              </View>
              <Text style={[styles.accountBalance, acc.balance >= 0 ? styles.incomeText : styles.expenseText]}>
                {formatCurrency(acc.balance)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nessun conto aggiunto.</Text>
        )}
      </View>

      {/* Transazioni Recenti */}
      <View style={styles.recentTransactionsContainer}>
        <View style={styles.listHeaderContainer}>
          <Text style={styles.listHeader}>Transazioni Recenti</Text>
          {filteredTransactions.length > 0 && (
            <TouchableOpacity onPress={() => setView('allTransactions')}>
              <Text style={styles.viewAllButtonText}>Mostra tutte</Text>
            </TouchableOpacity>
          )}
        </View>
        {filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>Nessuna transazione nel periodo selezionato.</Text>
        ) : (
          filteredTransactions.slice(0, 10).map((t) => (
            <View key={t.id} style={styles.transactionItem}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{t.description}</Text>
                <Text style={styles.transactionCategory}>
                  {accounts.find(acc => acc.id === t.accountId)?.bank} • {t.category}{t.subcategory ? ` (${t.subcategory})` : ''} • {new Date(t.timestamp).toLocaleDateString('it-IT')}
                </Text>
              </View>
              <View style={styles.transactionButtons}>
                <TouchableOpacity onPress={() => handleEditTransaction(t)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                  <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.transactionAmount, t.type === 'expense' ? styles.expenseText : styles.incomeText]}>
                {t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.spacer} />
    </ScrollView>
    );
  };

  // Renderizza la dashboard
  const renderDashboard = () => (
    <View style={{ flex: 1 }}>
      {/* Sub-navigation */}
      <View style={styles.dashboardNav}>
        <TouchableOpacity
          style={[styles.dashboardNavButton, dashboardView === 'balance' && styles.dashboardNavButtonActive]}
          onPress={() => setDashboardView('balance')}>
          <Text style={styles.dashboardNavButtonText}>Saldo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dashboardNavButton, dashboardView === 'expenses' && styles.dashboardNavButtonActive]}
          onPress={() => setDashboardView('expenses')}>
          <Text style={styles.dashboardNavButtonText}>Spese</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dashboardNavButton, dashboardView === 'income' && styles.dashboardNavButtonActive]}
          onPress={() => setDashboardView('income')}>
          <Text style={styles.dashboardNavButtonText}>Entrate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dashboardNavButton, dashboardView === 'budget' && styles.dashboardNavButtonActive]}
          onPress={() => setDashboardView('budget')}>
          <Text style={styles.dashboardNavButtonText}>Budget</Text>
        </TouchableOpacity>
      </View>
      {dashboardView === 'balance' && renderBalanceView()}
      {dashboardView === 'expenses' && renderExpensesView()}
      {dashboardView === 'income' && renderIncomeView()}
      {view === 'dashboard' && dashboardView === 'budget' && renderBudgetView()}
    </View>
  );



  // Renderizza la vista di tutte le transazioni
  const renderAllTransactions = () => (
    <View style={{ flex: 1 }}>
      <Text style={styles.header}>Tutte le Transazioni</Text>
      <FlatList
        style={styles.scrollContainer}
        data={filteredTransactions}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item: t }) => (
          <View key={t.id} style={styles.transactionItem}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>{t.description}</Text>
              <Text style={styles.transactionCategory}>
                {accounts.find(acc => acc.id === t.accountId)?.bank} • {t.category}{t.subcategory ? ` (${t.subcategory})` : ''} • {new Date(t.timestamp).toLocaleDateString('it-IT')}
              </Text>
            </View>
            <View style={styles.transactionButtons}>
              <TouchableOpacity onPress={() => handleEditTransaction(t)}>
                <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.transactionAmount, t.type === 'expense' ? styles.expenseText : styles.incomeText]}>
              {t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Nessuna transazione nel periodo selezionato.</Text>}
        ListFooterComponent={<View style={{ height: 100 }} />} // Spacer for the back button
      />
      <View style={styles.footerButtonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: Colors.placeholder, marginBottom: 0 }]}
          onPress={() => setView('dashboard')}
        >
          <Text style={styles.buttonText}>Indietro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  // Renderizza il form per aggiungere Spese/Entrate
  const renderForm = (type) => (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>{editingId ? `Modifica ${type === 'expense' ? 'Spesa' : 'Entrata'}` : `Aggiungi ${type === 'expense' ? 'Spesa' : 'Entrata'}`}</Text>
      <View style={styles.formContainer}>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>Per favore, aggiungi un conto prima di aggiungere una transazione.</Text>
        ) : (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Conto:</Text>
            <Picker
              selectedValue={accountId}
              onValueChange={(itemValue) => setAccountId(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {accounts.map(acc => (
                <Picker.Item key={acc.id} label={`${acc.bank} (${acc.description})`} value={acc.id} />
              ))}
            </Picker>
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder="Importo"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholderTextColor={Colors.placeholder}
        />
        <TextInput
          style={styles.input}
          placeholder="Descrizione"
          value={description}
          onChangeText={setDescription}
          placeholderTextColor={Colors.placeholder}
        />
        <>
            <View style={styles.pickerContainer}> 
              <Text style={styles.pickerLabel}>Categoria:</Text>
              <Picker
                selectedValue={category}
                onValueChange={(itemValue) => {
                  setCategory(itemValue);
                  setSubcategory(''); // Resetta la sottocategoria quando la categoria cambia
                }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {[...categories]                  
                  .filter(c => {
                    if (c.name === 'Prelievo') {
                      return type === 'expense' && accountId !== CASH_ACCOUNT_ID;
                    }
                    return true;
                  })
                  .sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                  <Picker.Item key={cat.name} label={cat.name} value={cat.name} />
                ))}
              </Picker>
            </View>
            
            {(() => {
              const selectedCat = categories.find(c => c.name === category);
              if (selectedCat && selectedCat.subcategories && selectedCat.subcategories.length > 0) {
                return (
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Sottocategoria (Opzionale):</Text>
                    <Picker selectedValue={subcategory} onValueChange={setSubcategory} style={styles.picker} itemStyle={styles.pickerItem}>
                      <Picker.Item label="-- Nessuna --" value="" />
                      {selectedCat.subcategories.sort((a, b) => a.localeCompare(b)).map(sub => <Picker.Item key={sub} label={sub} value={sub} />)}
                    </Picker>
                  </View>
                );
              }
              return null;
            })()}
        </>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Transazione Ricorrente</Text>
          <Switch
            trackColor={{ false: Colors.placeholder, true: Colors.secondary }}
            thumbColor={isRecurring ? Colors.text : '#f4f3f4'}
            onValueChange={setIsRecurring}
            value={isRecurring}
          />
        </View>

        {isRecurring && (
          <View style={styles.recurringContainer}>
            <Text style={styles.recurringHeader}>Impostazioni Ricorrenza</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Frequenza:</Text>
              <Picker selectedValue={recurrenceFrequency} onValueChange={(itemValue) => setRecurrenceFrequency(itemValue)} style={styles.picker} itemStyle={styles.pickerItem}>
                <Picker.Item label="Mensile" value="monthly" />
                <Picker.Item label="Giornaliera" value="daily" />
                <Picker.Item label="Settimanale" value="weekly" />
                <Picker.Item label="Annuale" value="yearly" />
              </Picker>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ogni (es. 1, 2...)"
              value={recurrenceInterval}
              onChangeText={setRecurrenceInterval}
              keyboardType="numeric"
              placeholderTextColor={Colors.placeholder} />
            <TextInput
              style={styles.input}
              placeholder="Numero di ripetizioni"
              value={recurrenceCount}
              onChangeText={setRecurrenceCount}
              keyboardType="numeric"
              placeholderTextColor={Colors.placeholder} />
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity style={[styles.inputTouchable, { flex: 1, marginRight: 5 }]} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputNoBorder}>
              Data: {transactionDate.toLocaleDateString('it-IT')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inputTouchable, { flex: 1, marginLeft: 5 }]} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputNoBorder}>
              Orario: {transactionDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={transactionDate}
            mode={'date'}
            display="default"
            onChange={onDateChange}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={transactionDate}
            mode={'time'}
            is24Hour={true}
            display="default"
            onChange={onTimeChange}
          />
        )}
        <TouchableOpacity
          style={styles.button}

          onPress={() => handleAddOrUpdateTransaction(type)}>
          <Text style={styles.buttonText}>
            {editingId ? "Salva Modifiche" : `Aggiungi ${type === 'expense' ? 'Spesa' : 'Entrata'}`}
          </Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => {
            setEditingId(null);
            setAmount('');
            setDescription('');
            setCategory(categories.length > 0 ? categories[0].name : 'Altro');
            setSubcategory('');
            setAccountId(getDefaultAccountId(accounts));
            setView('dashboard');
          }}>
            <Text style={styles.buttonText}>Annulla</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.spacer} />
    </ScrollView>
  );

  // Renderizza il form per la gestione dei conti
  const renderAccountManager = () => (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>Gestione Conti</Text>

      {/* Form per aggiungere/modificare un conto */}
      <View style={styles.formContainer}>
        <TouchableOpacity style={styles.inputTouchable} onPress={() => setIsBankModalVisible(true)}>
          <TextInput
            style={styles.inputNoBorder}
            placeholder="Nome Banca"
            value={accountBank}
            onChangeText={handleBankInputChange}
            editable={false} // Rendi il TextInput non modificabile direttamente
            placeholderTextColor={Colors.placeholder}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Numero Conto"
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholderTextColor={Colors.placeholder}
        />
        <TextInput
          style={styles.input}
          placeholder="Descrizione"
          value={accountDescription}
          onChangeText={setAccountDescription}
          placeholderTextColor={Colors.placeholder}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddOrUpdateAccount}>
          <Text style={styles.buttonText}>{editingAccountId ? "Salva Modifiche" : "Aggiungi Conto"}</Text>
        </TouchableOpacity>
        {editingAccountId && (
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => {
            setEditingAccountId(null);
            setAccountBank('');
            setAccountNumber('');
            setAccountDescription('');
          }}>
            <Text style={styles.buttonText}>Annulla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista dei conti esistenti */}
      <View style={styles.recentTransactionsContainer}>
        <Text style={styles.listHeader}>I Miei Conti</Text>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>Nessun conto aggiunto.</Text>
        ) : (
          accounts.map(acc => (
            <View key={acc.id} style={styles.accountItem}>
              <View style={styles.accountIcon}>
                <MaterialCommunityIcons name={getBankIconName(acc.bank)} size={24} color={Colors.text} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountBank}>{acc.bank}</Text>
                <Text style={styles.accountNumber}>{acc.description}</Text>
              </View>
              {acc.id !== CASH_ACCOUNT_ID && (
              <View style={styles.transactionButtons}>
                <TouchableOpacity onPress={() => {
                  setEditingAccountId(acc.id);
                  setAccountBank(acc.bank);
                  setAccountNumber(acc.number);
                  setAccountDescription(acc.description);
                }}>
                  <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteAccount(acc.id)}>
                  <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
                </TouchableOpacity>
              </View>
              )}
            </View>
          ))
        )}
      </View>
      <View style={styles.spacer} />
    </ScrollView>
  );

  // Renderizza il form per la gestione della configurazione
  const renderConfiguration = () => (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>Configurazione</Text>

      {/* Gestione Categorie */}
      <View style={styles.formContainer}>
        <TouchableOpacity style={styles.button} onPress={() => setView('manageCategories')}>
          <Text style={styles.buttonText}>Gestisci Categorie</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => {
          setTempBudgets(JSON.parse(JSON.stringify(budgets)));
          setView('manageBudgets');
        }}>
          <Text style={styles.buttonText}>Gestisci Budget</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Sync */}
      <View style={[styles.formContainer, { marginTop: 20 }]}>
        <Text style={styles.listHeader}>Sincronizzazione Google Calendar</Text>
        {userInfo ? (
          <View>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Abilita Sincronizzazione</Text>
              <Switch
                trackColor={{ false: Colors.placeholder, true: Colors.secondary }}
                thumbColor={isCalendarSyncEnabled ? Colors.text : '#f4f3f4'}
                onValueChange={toggleCalendarSync}
                value={isCalendarSyncEnabled}
              />
            </View>
            {isCalendarSyncEnabled && (
              <TouchableOpacity style={styles.button} onPress={handleManualCalendarSync} disabled={isBackingUp}>
                <Text style={styles.buttonText}>{isBackingUp ? "Sincronizzazione..." : "Sincronizza Transazioni Passate"}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.userInfoText}>La sincronizzazione aggiunge le transazioni come eventi privati con promemoria nel tuo calendario primario.</Text>
          </View>
        ) : (<Text style={styles.emptyText}>Effettua il login con Google per abilitare la sincronizzazione.</Text>)}
      </View>
      {/* Backup & Ripristino */}
      <View style={[styles.formContainer, { marginTop: 20 }]}>
        <Text style={styles.listHeader}>Backup & Ripristino</Text>
        {userInfo ? (
          <View>
            <Text style={styles.userInfoText}>Connesso come: {userInfo.name}</Text>            
            <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={backupData} disabled={isBackingUp || isRestoring}>
              <Text style={styles.buttonText}>{isBackingUp ? "Elaborazione..." : "Backup su Google Drive"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={restoreData} disabled={isBackingUp || isRestoring}>
              <Text style={styles.buttonText}>{isRestoring ? "Ripristino in corso..." : "Ripristina da Google Drive"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={() => promptAsync()} disabled={!request}>
            <Text style={styles.buttonText}>Login con Google</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={downloadBackup} disabled={isBackingUp || isRestoring}>
          <Text style={styles.buttonText}>{isBackingUp ? "Elaborazione..." : "Scarica Backup Locale"}</Text>
        </TouchableOpacity>
      </View>

      {/* Reset Dati */}
      <View style={[styles.formContainer, { marginTop: 20 }]}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleResetData}>
          <Text style={styles.buttonText}>Cancella Dati</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );

  // Renderizza il form per la gestione delle categorie
  const renderCategoryManager = () => (
    <ScrollView ref={categoryScrollViewRef} style={styles.scrollContainer}>
      <Text style={styles.header}>Gestione Categorie</Text>

      <View style={styles.formContainer}>
        <TextInput
          ref={categoryInputRef}
          style={styles.input}
          placeholder="Nome Categoria"
          value={categoryName}
          onChangeText={setCategoryName}
          placeholderTextColor={Colors.placeholder}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddOrUpdateCategory}>
          <Text style={styles.buttonText}>{editingCategoryName ? "Salva Modifiche" : "Aggiungi Categoria"}</Text>
        </TouchableOpacity>
        {editingCategoryName && (
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => {
            setEditingCategoryName(null);
            setCategoryName('');
          }}>
            <Text style={styles.buttonText}>Annulla</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.recentTransactionsContainer}>
        <Text style={styles.listHeader}>Le Mie Categorie</Text>
        {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
          <View key={cat.name} style={styles.accountItem}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountBank}>{cat.name}</Text>
            </View>
            {cat.name !== 'Altro' && (
              <View style={styles.transactionButtons}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    setSelectedCategoryForSubcat(cat);
                    setView('manageSubcategories');
                  }}
                >
                  <MaterialCommunityIcons name="playlist-plus" size={22} color={Colors.icon} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => handleEditCategory(cat.name)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteCategory(cat.name)}>
                  <MaterialCommunityIcons name="delete" size={20} color={Colors.red} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: Colors.placeholder }]} onPress={() => setView('configuration')}>
        <Text style={styles.buttonText}>Indietro</Text>
      </TouchableOpacity>
      <View style={styles.spacer} />
    </ScrollView>
  );

  // Renderizza il form per la gestione delle sottocategorie
  const renderSubcategoryManager = () => {
    if (!selectedCategoryForSubcat) return null;

    const mainCategory = categories.find(c => c.name === selectedCategoryForSubcat.name);
    const currentSubcategories = mainCategory ? mainCategory.subcategories : [];

    return (
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.header}>Sottocategorie di</Text>
        <Text style={[styles.header, { fontSize: 22, marginTop: -20, marginBottom: 20 }]}>"{selectedCategoryForSubcat.name}"</Text>

        <View style={styles.formContainer}>
          <TextInput style={styles.input} placeholder="Nome Sottocategoria" value={subcategoryName} onChangeText={setSubcategoryName} placeholderTextColor={Colors.placeholder} />
          <TouchableOpacity style={styles.button} onPress={handleAddOrUpdateSubcategory}>
            <Text style={styles.buttonText}>{editingSubcategoryName ? "Salva Modifiche" : "Aggiungi Sottocategoria"}</Text>
          </TouchableOpacity>
          {editingSubcategoryName && (
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => { setEditingSubcategoryName(null); setSubcategoryName(''); }}>
              <Text style={styles.buttonText}>Annulla</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.recentTransactionsContainer}>
          <Text style={styles.listHeader}>Sottocategorie Esistenti</Text>
          {currentSubcategories.length > 0 ? (
            [...currentSubcategories].sort((a, b) => a.localeCompare(b)).map(sub => (
              <View key={sub} style={styles.accountItem}>
                <View style={styles.accountInfo}><Text style={styles.accountBank}>{sub}</Text></View>
                <View style={styles.transactionButtons}>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleEditSubcategory(sub)}><MaterialCommunityIcons name="pencil" size={20} color={Colors.icon} style={{ marginRight: 10 }} /></TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteSubcategory(sub)}><MaterialCommunityIcons name="delete" size={20} color={Colors.red} /></TouchableOpacity>
                </View>
              </View>
            ))
          ) : (<Text style={styles.emptyText}>Nessuna sottocategoria definita.</Text>)}
        </View>
        <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: Colors.placeholder }]} onPress={() => setView('manageCategories')}><Text style={styles.buttonText}>Indietro</Text></TouchableOpacity>
        <View style={styles.spacer} />
      </ScrollView>
    );
  };

  // Renderizza il form per la gestione dei budget
  const renderBudgetManager = () => (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>Gestione Budget Mensile</Text>

      <View style={styles.formContainer}>
        <Text style={styles.listHeader}>Budget Totale</Text>
        <TextInput
          style={styles.input}
          placeholder="Budget Totale Mensile"
          value={tempBudgets.total?.toString() || ''}
          onChangeText={text => setTempBudgets(prev => ({ ...prev, total: text }))}
          keyboardType="numeric"
          placeholderTextColor={Colors.placeholder}
        />
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.listHeader}>Budget per Categoria</Text>
        {categories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
          <View key={cat.name} style={styles.budgetItem}>
            <Text style={styles.budgetCategoryName}>{cat.name}</Text>
            <TextInput
              style={styles.budgetInput}
              value={tempBudgets.categories?.[cat.name]?.toString() || ''}
              onChangeText={text => setTempBudgets(prev => ({
                ...prev,
                categories: { ...prev.categories, [cat.name]: text }
              }))}
              placeholder="€ 0"
              keyboardType="numeric"
              placeholderTextColor={Colors.placeholder}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSaveBudgets}>
        <Text style={styles.buttonText}>Salva Budget</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: Colors.placeholder }]} onPress={() => setView('configuration')}>
        <Text style={styles.buttonText}>Indietro</Text>
      </TouchableOpacity>
      <View style={styles.spacer} />
    </ScrollView>
  );
  // Renderizza il modal per i suggerimenti delle banche
  const renderBankSuggestionsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isBankModalVisible}
      onRequestClose={() => setIsBankModalVisible(false)}
    >
      <View style={bankModalStyles.centeredView}>
        <View style={bankModalStyles.modalView}>
          <TextInput
            style={bankModalStyles.searchBar}
            placeholder="Cerca banca..."
            onChangeText={handleBankInputChange}
            value={accountBank}
            placeholderTextColor={Colors.placeholder}
          />
          <FlatList
            keyboardShouldPersistTaps="always"
            data={filteredBanks}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={bankModalStyles.suggestionItem}
                onPress={() => {
                  setAccountBank(item);
                  setIsBankModalVisible(false);
                }}
              >
                <Text style={bankModalStyles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => item}
          />
          <Pressable
            style={[bankModalStyles.button, bankModalStyles.buttonClose]}
            onPress={() => setIsBankModalVisible(false)}
          >
            <Text style={bankModalStyles.textStyle}>Chiudi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.titleContainer}>
        <Image source={appTitleImage} style={styles.titleImage} />
      </View>
      {/* Barra di navigazione superiore */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={() => setView('dashboard')}>
          <MaterialCommunityIcons name="view-dashboard" size={24} color={view === 'dashboard' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'dashboard' ? { color: Colors.primary } : {}]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => {
          setView('addExpense');
          setEditingId(null);
          setAmount('');
          setDescription('');
          setCategory(categories.length > 0 ? categories[0].name : 'Altro');
          setSubcategory('');
          setAccountId(getDefaultAccountId(accounts));
        }}>
          <MaterialCommunityIcons name="cash-minus" size={24} color={view === 'addExpense' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'addExpense' ? { color: Colors.primary } : {}]}>Spesa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => {
          setView('addIncome');
          setEditingId(null);
          setAmount('');
          setDescription('');
          setCategory(categories.length > 0 ? categories[0].name : 'Altro');
          setSubcategory('');
          setAccountId(getDefaultAccountId(accounts));
        }}>
          <MaterialCommunityIcons name="cash-plus" size={24} color={view === 'addIncome' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'addIncome' ? { color: Colors.primary } : {}]}>Entrata</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => setView('manageAccounts')}>
          <MaterialCommunityIcons name="bank" size={24} color={view === 'manageAccounts' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'manageAccounts' ? { color: Colors.primary } : {}]}>Conti</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => setView('configuration')}>
          <MaterialCommunityIcons name="cog" size={24} color={view === 'configuration' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'configuration' ? { color: Colors.primary } : {}]}>Config</Text>
        </TouchableOpacity>
      </View>

      {view === 'dashboard' && renderDashboard()}
      {view === 'addExpense' && renderForm('expense')}
      {view === 'addIncome' && renderForm('income')}
      {view === 'manageAccounts' && renderAccountManager()}
      {view === 'configuration' && renderConfiguration()}
      {view === 'allTransactions' && renderAllTransactions()}
      {view === 'manageSubcategories' && renderSubcategoryManager()}
      {view === 'manageCategories' && renderCategoryManager()}
      
      {view === 'manageBudgets' && renderBudgetManager()}

      {/* Aggiunta del componente CustomAlert */}
      <CustomAlert
        isVisible={isAlertVisible}
        title={alertTitle}
        message={alertMessage}
        onConfirm={alertOnConfirm}
        onCancel={alertOnCancel}
        showCancelButton={showCancelButton}
      />
      {renderBankSuggestionsModal()}
    </SafeAreaView>
  );
};

// Fogli di stile per i componenti
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  titleContainer: {
    width: "100%",
    height: 80,
    justifyContent: 'center',
    alignItems: 'left',
    backgroundColor: Colors.background,
  },
  titleImage: {
    flex:1,
    width: '100%', // Regola la larghezza in base alle tue esigenze
    resizeMode: 'stretch',
    aspectRatio: 4.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.text,
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.placeholder,
  },
  // Dashboard Styles
  dashboardNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.cardBackground,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  dashboardNavButton: {
    padding: 10,
    borderRadius: 5,
  },
  dashboardNavButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  dashboardNavButtonText: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  dashboardCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  balanceCard: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    color: Colors.placeholder,
    marginBottom: 5,
  },
  cardAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  incomeCard: {
    flex: 1,
    marginRight: 7,
  },
  expenseCard: {
    flex: 1,
    marginLeft: 7,
  },
  incomeText: {
    color: Colors.secondary,
  },
  expenseText: {
    color: Colors.red,
  },
  chartContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentTransactionsContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    marginTop: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  chartCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 5, // Aggiunto per evitare che il testo tocchi i bordi
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 10,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  transactionCategory: {
    fontSize: 12,
    color: Colors.placeholder,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.placeholder,
    marginTop: 10,
    marginBottom: 10,
  },
  // Form Styles
  formContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  input: {
    height: 50,
    backgroundColor: '#4b5563',
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.text,
  },
  inputTouchable: {
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#4b5563',
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  inputNoBorder: {
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  pickerContainer: {
    backgroundColor: '#4b5563',
    borderRadius: 10,
    marginBottom: 10,
  },
  pickerLabel: {
    position: 'absolute',
    top: 5,
    left: 15,
    fontSize: 12,
    color: Colors.placeholder,
  },
  picker: {
    height: 50,
    width: '100%',
    color: Colors.text,
    backgroundColor: Colors.cardBackground, 
  },
  pickerItem: {
    color: Colors.text,
  },
  pickerWrapper: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#4b5563',
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: Colors.red,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  spacer: {
    height: 100,
  },
  // Navigation Bar Styles

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  filterContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  subFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  accountIcon: {
    marginRight: 10,
  },
  accountInfo: {
    flex: 1,
    marginRight: 10,
  },
  accountBank: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  accountNumber: {
    fontSize: 12,
    color: Colors.placeholder,
    marginTop: 2,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  recurringContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
  },
  recurringHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#4b5563',
    marginVertical: 20,
  },
  userInfoText: {
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#4285F4', // Google Blue
  },
  logoutButton: {
    backgroundColor: Colors.placeholder,
  },
  legendContainer: {
    marginTop: 15,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  legendItemContainer: {
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColorBox: {
    width: 16,
    height: 16,
    marginRight: 8,
    borderRadius: 3,
  },
  legendText: {
    color: Colors.text,
    fontSize: 15,
    flex: 1,
  },
  viewAllButtonText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  footerButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30, // Extra padding for home indicator
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#4b5563',
  },
  budgetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  budgetCategoryName: {
    color: Colors.text,
    fontSize: 16,
    flex: 1,
  },
  budgetInput: {
    color: Colors.text,
    fontSize: 16,
    textAlign: 'right',
    paddingVertical: 5,
    paddingHorizontal: 10,
    minWidth: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
  },
  budgetBarContainer: {
    marginTop: 8,
  },
  budgetBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  budgetBarLabel: {
    color: Colors.placeholder,
    fontSize: 12,
  },
  budgetBarAmount: {
    color: Colors.placeholder,
    fontSize: 12,
    fontWeight: 'bold',
  },
  budgetBarBackground: {
    height: 8,
    backgroundColor: '#4b5563',
    borderRadius: 4,
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetItemContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  budgetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetItemDetails: {
    color: Colors.placeholder,
    fontSize: 14,
    marginTop: 4,
  },
});
const bankModalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendColorBox: {
    width: 16,
    height: 16,
    marginRight: 8,
    borderRadius: 3,
  },
  legendText: {
    color: Colors.text,
    fontSize: 15,
  },
  viewAllButtonText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  footerButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30, // Extra padding for home indicator
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#4b5563',
  },
});

export default App;
