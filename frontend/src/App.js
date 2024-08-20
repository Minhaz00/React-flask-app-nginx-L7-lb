import React, { useState, useEffect } from 'react';


function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    
   const apiUrl = process.env.REACT_APP_API_URL;
    fetch(`${apiUrl}/api/message`)
      .then(response => response.json())
      .then(data => {
        setMessage(data.message);
      })
      .catch(error => {
        console.error('Error fetching the message:', error);
      });
  }, []);

  return (
    <div className="App">
      <h3>Message from Flask API:</h3>
      <h3>{message}</h3>
    </div>
  );
}

export default App;
