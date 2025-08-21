import React, { useState, useEffect } from 'react';
import { Image, StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions, Modal, Pressable, FlatList, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import appTitleImage from '../assets/expense-tracker-title.png';
import { screenWidth, predefined_banks, categories, months, years } from '../src/constants';
import { Colors } from '../src/styles/AllStyles';
import { formatCurrency, getBankIconName } from '../src/utils';
import { CustomAlert } from '../src/screens/CustomAlert.js';

// Componente principale dell'app
const App = () => {
  // Stati per i dati dell'applicazione
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Altro');
  const [accountId, setAccountId] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'addExpense', 'addIncome', 'manageAccounts'
  const [editingId, setEditingId] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('total'); // 'total', 'month', 'year'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedAccountId, setSelectedAccountId] = useState('all');

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

  // Funzione per mostrare il popup personalizzato
  const showCustomAlert = (title, message, onConfirm, onCancel = () => {setIsAlertVisible(false)}, showCancel = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOnConfirm(() => onConfirm);
    setAlertOnCancel(() => onCancel);
    setShowCancelButton(showCancel);
    setIsAlertVisible(true);
  };

  // Carica i dati da Async Storage all'avvio
  const loadData = async () => {
    try {
      let loadedTransactions = [];
      let loadedRecurring = [];
      const storedData = await AsyncStorage.getItem('financeData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        if (parsedData.transactions) {
          // Ordina le transazioni per data, dalla più recente
          parsedData.transactions.sort((a, b) => b.timestamp - a.timestamp);
          setTransactions(parsedData.transactions);
          loadedTransactions = parsedData.transactions;
        }
        if (parsedData.accounts) {
          setAccounts(parsedData.accounts);
          // Imposta il primo conto come predefinito se non c'è un ID salvato
          if (parsedData.recurringTransactions) {
            setRecurringTransactions(parsedData.recurringTransactions);
            loadedRecurring = parsedData.recurringTransactions;
          }
          if (parsedData.accounts.length > 0 && !accountId) {
            setAccountId(parsedData.accounts[0].id);
          }
        }
      }
      return { loadedTransactions, loadedRecurring };
    } catch (e) {
      console.error("Errore nel caricamento dei dati da Async Storage:", e);
      showCustomAlert("Errore", "Si è verificato un problema nel caricamento dei dati.", () => setIsAlertVisible(false));
      return { loadedTransactions: [], loadedRecurring: [] };
    }
  };

  // Salva i dati in Async Storage
  const saveData = async (newTransactions, newAccounts, newRecurringTransactions) => {
    try {
      const dataToSave = {
        transactions: newTransactions || transactions,
        accounts: newAccounts || accounts,
        recurringTransactions: newRecurringTransactions !== undefined ? newRecurringTransactions : recurringTransactions,
      };
      await AsyncStorage.setItem('financeData', JSON.stringify(dataToSave));
      if (newTransactions) setTransactions(newTransactions);
      if (newAccounts) setAccounts(newAccounts);
      if (newRecurringTransactions !== undefined) setRecurringTransactions(newRecurringTransactions);
    } catch (e) {
      console.error("Errore nel salvataggio dei dati in Async Storage:", e);
      showCustomAlert("Errore", "Si è verificato un problema nel salvataggio dei dati.", () => setIsAlertVisible(false));
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

  const processRecurringTransactions = async (currentTransactions, currentRecurring) => {
    const now = Date.now();
    let newTransactions = [];
    let hasChanges = false;

    const updatedRecurring = currentRecurring.map(template => {
      let newTemplate = { ...template };
      while (newTemplate.generatedCount < newTemplate.count && newTemplate.nextDueDate <= now) {
        hasChanges = true;
        const newTransaction = {
          id: `${template.id}-${newTemplate.generatedCount}`,
          amount: newTemplate.amount,
          description: `${newTemplate.description} (${newTemplate.generatedCount + 1}/${newTemplate.count})`,
          category: newTemplate.category,
          type: newTemplate.type,
          accountId: newTemplate.accountId,
          timestamp: newTemplate.nextDueDate,
          isRecurring: true,
          recurringTemplateId: template.id,
        };
        newTransactions.push(newTransaction);
        newTemplate.generatedCount += 1;
        newTemplate.nextDueDate = getNextDueDate(newTemplate.nextDueDate, newTemplate.frequency, newTemplate.interval);
      }
      return newTemplate;
    });

    if (hasChanges) {
      const allTransactions = [...currentTransactions, ...newTransactions].sort((a, b) => b.timestamp - a.timestamp);
      const finalRecurring = updatedRecurring.filter(t => t.generatedCount < t.count);
      await saveData(allTransactions, null, finalRecurring);
    }
  };

  // Funzione per gestire l'aggiunta o la modifica di una transazione
  const handleAddOrUpdateTransaction = (type) => {
    if (isRecurring) {
      handleSaveRecurringTransaction(type);
      return;
    }

    if (!amount || !description || !accountId) {
      showCustomAlert("Errore", "Per favore, inserisci tutti i campi (importo, descrizione e conto).", () => setIsAlertVisible(false));
      return;
    }

    const newTransaction = {
      id: editingId || Date.now().toString(),
      amount: parseFloat(amount),
      description: description,
      category: category,
      type: type, // 'expense' o 'income'
      accountId: accountId, // Aggiungi l'ID del conto
      timestamp: transactionDate.getTime(),
    };

    let updatedTransactions;
    if (editingId) {
      // Modifica la transazione esistente
      updatedTransactions = transactions.map(t => t.id === editingId ? newTransaction : t);
      showCustomAlert("Transazione aggiornata", "La transazione è stata aggiornata con successo.", () => setIsAlertVisible(false));
    } else {
      updatedTransactions = [newTransaction, ...transactions];
      showCustomAlert("Transazione aggiunta", "La transazione è stata aggiunta con successo.", () => setIsAlertVisible(false));
    }

    saveData(updatedTransactions, null, null);
    
    // Resetta i campi e torna alla dashboard
    setAmount('');
    setDescription('');
    setCategory('Altro');
    setEditingId(null);
    setTransactionDate(new Date());
    setIsRecurring(false);
    setAccountId(accounts.length > 0 ? accounts[0].id : null);
    setView('dashboard');

  };

  const handleSaveRecurringTransaction = (type) => { // Handles both create and update
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
    setRecurrenceInterval('1'); setRecurrenceCount('12'); setAccountId(accounts.length > 0 ? accounts[0].id : null);
    processRecurringTransactions(transactions, updatedRecurring);
    showCustomAlert("Transazione Ricorrente Aggiunta", "La serie di transazioni ricorrenti è stata creata.", () => {
      setIsAlertVisible(false);
      setView('dashboard');
    });
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const currentDate = selectedDate || transactionDate;
      setTransactionDate(currentDate);
    }
  };

  // Gestisce l'eliminazione di una transazione
  const handleDeleteTransaction = (id) => {
    showCustomAlert(
      "Conferma",
      "Sei sicuro di voler eliminare questa transazione?",
      () => {
        const updatedTransactions = transactions.filter(t => t.id !== id); 
        saveData(updatedTransactions, null);
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
        id: Date.now().toString(),
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
  const handleDeleteAccount = (id) => {
    showCustomAlert(
      "Conferma",
      "Eliminare questo conto eliminerà anche tutte le transazioni e le serie ricorrenti ad esso associate. Continuare?",
      () => {
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
        setAccounts([]);
        setRecurringTransactions([]);
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

  // Carica i dati all'avvio del componente
  useEffect(() => {
    const initAndProcess = async () => {
      const { loadedTransactions, loadedRecurring } = await loadData();
      await processRecurringTransactions(loadedTransactions, loadedRecurring);
    };
    initAndProcess();
  }, []);

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
      color: Colors.chartColors[index % Colors.chartColors.length],
      legendFontColor: Colors.text,
      legendFontSize: 14,
    };
  });

  // Calcola i saldi per ogni conto
  const accountBalances = accounts.map(account => {
    const accountIncome = transactions.filter(t => t.type === 'income' && t.accountId === account.id).reduce((sum, t) => sum + t.amount, 0);
    const accountExpenses = transactions.filter(t => t.type === 'expense' && t.accountId === account.id).reduce((sum, t) => sum + t.amount, 0);
    return {
      ...account,
      balance: accountIncome - accountExpenses,
    };
  });

  // Renderizza la dashboard
  const renderDashboard = () => (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.header}>Dashboard</Text>

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

      {/* Grafico a Torta delle Spese */}
      <View style={styles.chartContainer}>
        <Text style={styles.listHeader}>Ripartizione Spese</Text>
        {pieChartData.length > 0 ? (
          <PieChart
            data={pieChartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        ) : (
          <Text style={styles.emptyText}>Nessuna spesa nel periodo selezionato.</Text>
        )}
      </View>

      {/* Card del Saldo Totale */}
      <View style={[styles.dashboardCard, styles.balanceCard]}>
        <Text style={styles.cardTitle}>Saldo Totale</Text>
        <Text style={[styles.cardAmount, totalBalance >= 0 ? styles.incomeText : styles.expenseText]}>
          {formatCurrency(totalBalance)}
        </Text>
      </View>
      
      {/* Selettore del periodo */}
      <View style={styles.chartContainer}>
        <Text style={styles.listHeader}>Filtri</Text>
        <Picker
          selectedValue={filterPeriod}
          onValueChange={(itemValue) => setFilterPeriod(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Totale" value="total" />
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

      {/* Card dei Totali */}
      <View style={styles.totalsContainer}>
        <View style={[styles.dashboardCard, styles.incomeCard]}>
          <Text style={styles.cardTitle}>Entrate</Text>
          <Text style={[styles.cardAmount, styles.incomeText]}>{formatCurrency(totalIncome)}</Text>
        </View>
        <View style={[styles.dashboardCard, styles.expenseCard]}>
          <Text style={styles.cardTitle}>Uscite</Text>
          <Text style={[styles.cardAmount, styles.expenseText]}>{formatCurrency(totalExpenses)}</Text>
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
        <Text style={styles.listHeader}>Transazioni Recenti</Text>
        {filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>Nessuna transazione nel periodo selezionato.</Text>
        ) : (
          filteredTransactions.slice(0, 10).map((t) => (
            <View key={t.id} style={styles.transactionItem}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{t.description}</Text>
                <Text style={styles.transactionCategory}>
                  {accounts.find(acc => acc.id === t.accountId)?.bank} • {t.category} • {new Date(t.timestamp).toLocaleDateString('it-IT')}
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
        {type === 'expense' && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Categoria:</Text>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {categories.map(cat => (
                <Picker.Item key={cat} label={cat} value={cat} />
              ))}
            </Picker>
          </View>
        )}
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
        <TouchableOpacity style={styles.inputTouchable} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.inputNoBorder}>
            Data: {transactionDate.toLocaleDateString('it-IT')}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={transactionDate}
            mode={'date'}
            display="default"
            onChange={onDateChange}
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
            setCategory('Altro');
            setAccountId(accounts.length > 0 ? accounts[0].id : null);
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
        <TouchableOpacity style={[styles.button, styles.cancelButton, { marginTop: 20 }]} onPress={handleResetData}>
          <Text style={styles.buttonText}>Resetta Dati</Text>
        </TouchableOpacity>
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
            </View>
          ))
        )}
      </View>
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
          setCategory('Altro');
          setAccountId(accounts.length > 0 ? accounts[0].id : null);
        }}>
          <MaterialCommunityIcons name="cash-minus" size={24} color={view === 'addExpense' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'addExpense' ? { color: Colors.primary } : {}]}>Spesa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => {
          setView('addIncome');
          setEditingId(null);
          setAmount('');
          setDescription('');
          setCategory('Altro');
          setAccountId(accounts.length > 0 ? accounts[0].id : null);
        }}>
          <MaterialCommunityIcons name="cash-plus" size={24} color={view === 'addIncome' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'addIncome' ? { color: Colors.primary } : {}]}>Entrata</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => setView('manageAccounts')}>
          <MaterialCommunityIcons name="bank" size={24} color={view === 'manageAccounts' ? Colors.primary : Colors.icon} />
          <Text style={[styles.navButtonText, view === 'manageAccounts' ? { color: Colors.primary } : {}]}>Conti</Text>
        </TouchableOpacity>
      </View>

      {view === 'dashboard' && renderDashboard()}
      {view === 'addExpense' && renderForm('expense')}
      {view === 'addIncome' && renderForm('income')}
      {view === 'manageAccounts' && renderAccountManager()}

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
  // Dashboard Styles
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
  },
  recentTransactionsContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
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
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    height: '70%',
  },
  searchBar: {
    height: 50,
    width: '100%',
    backgroundColor: '#4b5563',
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.text,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#6b7280',
    width: '100%',
  },
  suggestionText: {
    color: Colors.text,
    fontSize: 16,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    marginTop: 15,
    width: '100%',
  },
  buttonClose: {
    backgroundColor: Colors.red,
  },
  textStyle: {
    color: Colors.text,
    fontWeight: "bold",
    textAlign: "center"
  }
});

export default App;
