import { Redirect } from 'expo-router';

export default function Demo() {
  return <Redirect href={{ pathname: '/', params: { demo: '1' } }} />;
}
