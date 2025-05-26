import { useEffect, useState } from 'react';
import { getUserSettings, saveUserSettings } from '../firebaseUtils';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

export default function Settings() {
  const [user] = useAuthState(auth);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then((settings) => {
        setApiKey(settings.easypostApiKey || '');
        setLoading(false);
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (user) {
      await saveUserSettings(user.uid, { easypostApiKey: apiKey });
      alert('API Key saved!');
    }
  };

  if (!user) return <p>Please sign in</p>;
  if (loading) return <p>Loading settings...</p>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded shadow">
      <h2 className="text-lg font-bold mb-3">EasyPost API Key</h2>
      <input
        type="text"
        className="border px-2 py-1 w-full mb-2"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your EasyPost API key"
      />
      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}
