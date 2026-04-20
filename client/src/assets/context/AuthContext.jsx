import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [token, setToken] = useState(null);

    useEffect(() => {
        const checkAuth = () => {
            const storedUser = sessionStorage.getItem('user');
            const storedToken = sessionStorage.getItem('token');
            
            if (storedUser && storedToken) {
                setUser(JSON.parse(storedUser));
                setToken(storedToken);
            }
            setLoading(false);
        };
        
        checkAuth();
    }, []);

    const login = async (userData, authToken) => {
        setUser(userData);
        setToken(authToken);
        sessionStorage.setItem('user', JSON.stringify(userData));
        sessionStorage.setItem('token', authToken);
    };

    const logout = async () => {
        setUser(null);
        setToken(null);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);