import React from 'react';
import { registerRootComponent } from 'expo';
import { Text, View } from 'react-native';
import { detectSession } from '@omegdadi/session-driver';
function App() { return React.createElement(View, null, React.createElement(Text, { testID: 'verdict' }, detectSession().verdict)); }
registerRootComponent(App);
