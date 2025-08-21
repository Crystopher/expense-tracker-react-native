import { StyleSheet } from 'react-native';

export const Colors = {
  primary: '#4f46e5',
  primaryDark: '#3730a3',
  secondary: '#10b981',
  background: '#1f2937',
  cardBackground: '#374151',
  text: '#f3f4f6',
  placeholder: '#9ca3af',
  red: '#ef4444',
  chartColors: ['#a855f7', '#6366f1', '#f97316', '#ef4444', '#10b981', '#3b82f6', '#f59e0b'],
  icon: '#9ca3af',
};

// Fogli di stile per i componenti
export const mainStyles = StyleSheet.create({
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