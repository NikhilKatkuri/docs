import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Page() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/auth', { replace: true });
    }, [navigate]);

    return null;
}
