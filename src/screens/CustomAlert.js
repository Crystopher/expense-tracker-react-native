import { View, StyleSheet, Text, Modal, Pressable } from 'react-native';
import { Colors } from '../../src/styles/AllStyles';

// Componente personalizzato per il popup di avviso/conferma
export const CustomAlert = ({ isVisible, title, message, onConfirm, onCancel, showCancelButton }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {
        onCancel();
      }}
    >
      <View style={customAlertStyles.centeredView}>
        <View style={customAlertStyles.modalView}>
          <Text style={customAlertStyles.modalTitle}>{title}</Text>
          <Text style={customAlertStyles.modalText}>{message}</Text>
          <View style={customAlertStyles.buttonContainer}>
            {showCancelButton && (
              <Pressable
                style={[customAlertStyles.button, customAlertStyles.buttonCancel]}
                onPress={onCancel}
              >
                <Text style={customAlertStyles.textStyle}>Annulla</Text>
              </Pressable>
            )}
            <Pressable
              style={[customAlertStyles.button, customAlertStyles.buttonConfirm]}
              onPress={onConfirm}
            >
              <Text style={customAlertStyles.textStyle}>{showCancelButton ? 'Conferma' : 'OK'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const customAlertStyles = StyleSheet.create({
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
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalText: {
    marginBottom: 20,
    textAlign: "center",
    color: Colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
  },
  buttonConfirm: {
    backgroundColor: Colors.primary,
    marginLeft: 5,
  },
  buttonCancel: {
    backgroundColor: Colors.red,
    marginRight: 5,
  },
  textStyle: {
    color: Colors.text,
    fontWeight: "bold",
    textAlign: "center"
  }
});