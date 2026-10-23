import { Outlet } from 'react-router';

const layout = () => {
    return (
        <div className="h-screen bg-surface-primary w-screen">
            <div className="h-full grid grid-cols-[1fr_500px] overflow-hidden  relative">
                <div className="relative">
                    <div className="absolute inset-0 z-0">
                        <div className="relative h-full w-full before:content-[''] before:absolute before:inset-0 before:bg-black/50 before:z-10">
                            <img
                                className="object-cover h-full w-full"
                                src="/solitary-tree-verdant-hill-mountain-landscape.webp"
                                alt="Mountain landscape background"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-2 relative z-10 w-full flex-1 bg-surface-secondary">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default layout;
