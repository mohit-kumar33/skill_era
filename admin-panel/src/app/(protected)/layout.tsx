import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="ml-64 flex flex-1 flex-col">
                <Topbar />
                <main className="flex-1 p-6">{children}</main>
            </div>
        </div>
    );
}
