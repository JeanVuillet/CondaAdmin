import React, { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [role, setRole] = useState(null); // null, 'STUDENT', 'PROF', 'ADMIN'
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // État Finder Élève
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    fetch('/api/auth/config').then(r => r.json()).then(data => setClassrooms(data.classrooms || []));
  }, []);

  useEffect(() => {
    if (selectedClassId) {
        fetch(`/api/auth/students/${selectedClassId}`).then(r => r.json()).then(data => setStudents(data));
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (studentSearch.length > 1) {
        setFilteredStudents(students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase())));
    } else {
        setFilteredStudents([]);
    }
  }, [studentSearch, students]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
        role,
        firstName: fName,
        lastName: lName,
        password,
        studentId: selectedStudent?.id
    };

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('player', JSON.stringify(data.user));
            onLoginSuccess(data.user);
        } else {
            alert(data.message || "Erreur de connexion");
        }
    } catch(e) { alert("Serveur injoignable"); }
    setLoading(false);
  };

  if (!role) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="app-logo">Condamine Pro</h1>
          <p className="app-subtitle">Choisissez votre espace</p>
          <div className="role-grid">
            <div className="role-card role-student" onClick={() => setRole('STUDENT')}>
                <span className="role-icon">🎒</span>
                <span className="role-label">Élève</span>
            </div>
            <div className="role-card role-teacher" onClick={() => setRole('PROF')}>
                <span className="role-icon">🎓</span>
                <span className="role-label">Professeur</span>
            </div>
            <div className="role-card role-admin" onClick={() => setRole('ADMIN')}>
                <span className="role-icon">🛡️</span>
                <span className="role-label">Admin</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card narrow">
        <button className="back-btn" onClick={() => { setRole(null); setSelectedStudent(null); }}>← Retour</button>
        <h2 className="app-logo">{role === 'STUDENT' ? 'Espace Élève' : (role === 'PROF' ? 'Espace Prof' : 'Espace Admin')}</h2>
        
        <form onSubmit={handleLogin} className="login-inputs">
            {role === 'STUDENT' ? (
                <div className="finder-wrapper">
                    {!selectedStudent ? (
                        <>
                            <select className="login-field" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                                <option value="">Sélectionnez votre classe...</option>
                                {classrooms.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                            {selectedClassId && (
                                <div className="relative">
                                    <input className="login-field" placeholder="Tapez votre nom..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                                    {filteredStudents.length > 0 && (
                                        <div className="suggestions-box">
                                            {filteredStudents.map(s => (
                                                <div key={s.id} className="suggestion-item" onClick={() => setSelectedStudent(s)}>
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="selected-student-card">
                            <span>{selectedStudent.name}</span>
                            <button type="button" className="reset-selection-btn" onClick={() => setSelectedStudent(null)}>✕</button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <input className="login-field" placeholder="Prénom" value={fName} onChange={e => setFName(e.target.value)} required />
                    <input className="login-field" placeholder="Nom" value={lName} onChange={e => setLName(e.target.value)} required />
                    <input className="login-field" type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
                </>
            )}
            <button className="login-submit-btn" disabled={loading || (role === 'STUDENT' && !selectedStudent)}>
                {loading ? 'Connexion...' : 'Entrer'}
            </button>
        </form>
      </div>
    </div>
  );
}