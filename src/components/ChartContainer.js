import { View, Text } from 'react-native';
import { mainStyles } from '../../src/styles/AllStyles';
import { PieChart } from 'react-native-chart-kit';

export const ChartContainer = ({ screenWidth, pieChartData }) => {
    return (
      <View style={mainStyles.chartContainer}>
        <Text style={mainStyles.listHeader}>Ripartizione Spese</Text>
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
          <Text style={mainStyles.emptyText}>Nessuna spesa nel periodo selezionato.</Text>
        )}
      </View>
      );
};