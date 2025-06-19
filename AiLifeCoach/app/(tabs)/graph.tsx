import { useState } from 'react';

import {
  View,
  ScrollView,
} from 'react-native';

export default function HomeScreen() {
  const [currentPage, setCurrentPage] = useState<'Chat' | 'Graph' | 'Profile'>('Chat');

  return (
    <View>
      <ScrollView>

      </ScrollView>
    </View>
  );
}