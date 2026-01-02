'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    ArrowLeft, Image as ImageIcon, X, Mic2, Music, MapPin,
    Save, Loader2, ChevronDown, Search
} from 'lucide-react'
import imageCompression from 'browser-image-compression';

// Mock Data for Location Search (Since we don't have a live Maps API)
const INDIAN_CITIES = [
    "Mumbai, Maharashtra", "Delhi, India", "Bangalore, Karnataka", "Hyderabad, Telangana",
    "Ahmedabad, Gujarat", "Chennai, Tamil Nadu", "Kolkata, West Bengal", "Surat, Gujarat",
    "Pune, Maharashtra", "Jaipur, Rajasthan", "Lucknow, Uttar Pradesh", "Kanpur, Uttar Pradesh",
    "Nagpur, Maharashtra", "Indore, Madhya Pradesh", "Thane, Maharashtra", "Bhopal, Madhya Pradesh",
    "Visakhapatnam, Andhra Pradesh", "Pimpri-Chinchwad, Maharashtra", "Patna, Bihar", "Vadodara, Gujarat"
]

export default function CreatePostPage() {
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // State
    const [user, setUser] = useState<any>(null)
    const [content, setContent] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null) // NEW: Location State

    // UI States
    const [isPosting, setIsPosting] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [showLocationModal, setShowLocationModal] = useState(false) // NEW: Modal State
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
            const savedText = localStorage.getItem('desi_draft_text')
            if (savedText) setContent(savedText)
        }
        init()
    }, [router, supabase])

    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem('desi_draft_text', content)
            setIsSaved(true)
            setTimeout(() => setIsSaved(false), 2000)
        }, 1000)
        return () => clearTimeout(timer)
    }, [content])

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const originalFile = e.target.files[0];
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: "image/jpeg" };
            try {
                const compressedBlob = await imageCompression(originalFile, options);
                const compressedFile = new File([compressedBlob], originalFile.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
                setImageFile(compressedFile);
                setImagePreview(URL.createObjectURL(compressedFile));
            } catch (error) {
                alert("Image error. Try another.");
            }
        }
    }

    const handlePost = async () => {
        if (!content.trim() && !imageFile) return
        setIsPosting(true)

        try {
            let imageUrl = null
            if (imageFile) {
                const fileExt = "jpg"
                const fileName = `${user.id}-${Math.random()}.${fileExt}`
                const { error: uploadError } = await supabase.storage.from('post_images').upload(fileName, imageFile)
                if (uploadError) throw uploadError
                const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(fileName)
                imageUrl = publicUrl
            }

            // Insert Post WITH Location
            const { error } = await supabase.from('posts').insert({
                user_id: user.id,
                content: content,
                image_url: imageUrl,
                location: location // Save location to DB
            })
            if (error) throw error

            localStorage.removeItem('desi_draft_text')
            router.push('/')
            router.refresh()

        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setIsPosting(false)
        }
    }

    // Filter cities based on search
    const filteredCities = INDIAN_CITIES.filter(city => city.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] text-gray-900 dark:text-white flex flex-col relative">

            {/* HEADER */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-md z-40">
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-sm">New Post</span>
                    {isSaved && <span className="text-[10px] text-green-500 font-bold animate-pulse flex items-center gap-1"><Save size={8} /> Draft Saved</span>}
                </div>
                <button
                    onClick={handlePost}
                    disabled={isPosting || (!content.trim() && !imageFile)}
                    className="bg-crimson text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-crimson/30 hover:opacity-90 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                    {isPosting ? <Loader2 className="animate-spin" size={18} /> : 'Post'}
                </button>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-crimson to-nebula flex items-center justify-center text-white font-bold text-xl shadow-md">
                        {user?.email?.[0].toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold text-lg">{user?.user_metadata?.username || "You"}</div>

                        {/* Display Selected Location Here */}
                        {location ? (
                            <div className="flex items-center gap-1 text-xs text-crimson font-bold border border-crimson/20 bg-crimson/5 px-2 py-0.5 rounded-full w-fit mt-1">
                                <MapPin size={10} /> {location}
                                <button onClick={() => setLocation(null)} className="ml-1 hover:text-red-600"><X size={10} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-full w-fit mt-1">
                                Public <ChevronDown size={10} />
                            </div>
                        )}
                    </div>
                </div>

                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's strictly on your mind?"
                    className="w-full h-40 md:h-64 bg-transparent outline-none text-2xl placeholder-gray-300 dark:placeholder-gray-700 resize-none leading-relaxed"
                    autoFocus
                />

                {imagePreview && (
                    <div className="relative w-full h-auto rounded-2xl overflow-hidden mb-8 shadow-xl border border-gray-100 dark:border-white/10 animate-in zoom-in-95 duration-300">
                        <Image src={imagePreview} alt="preview" width={800} height={600} className="w-full h-auto object-cover" />
                        <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/80 transition-colors"><X size={20} /></button>
                    </div>
                )}
            </div>

            {/* FOOTER TOOLBAR */}
            <div className="p-4 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] pb-8 md:pb-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                        <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
                        <ToolbarBtn icon={<ImageIcon size={24} />} label="Photo" color="text-green-500" onClick={() => fileInputRef.current?.click()} />
                        <ToolbarBtn icon={<Music size={24} />} label="Music" color="text-blue-500" />
                        <ToolbarBtn icon={<Mic2 size={24} />} label="Audio" color="text-purple-500" />

                        {/* Location Button triggers Modal */}
                        <ToolbarBtn
                            icon={<MapPin size={24} />}
                            label="Location"
                            color={location ? "text-crimson" : "text-red-500"}
                            onClick={() => setShowLocationModal(true)}
                        />
                    </div>
                </div>
            </div>

            {/* LOCATION SEARCH MODAL */}
            {showLocationModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#111] w-full md:max-w-md h-[80vh] md:h-auto md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Search Location</h3>
                            <button onClick={() => setShowLocationModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-4">
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-3 rounded-xl mb-4">
                                <Search size={20} className="text-gray-400" />
                                <input
                                    autoFocus
                                    placeholder="Search city (e.g. Surat)"
                                    className="bg-transparent outline-none flex-1"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="h-64 overflow-y-auto space-y-1 custom-scrollbar">
                                {filteredCities.map((city, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { setLocation(city); setShowLocationModal(false); setSearchQuery('') }}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                                    >
                                        <div className="p-2 bg-gray-200 dark:bg-white/10 rounded-full"><MapPin size={16} /></div>
                                        <span className="font-medium">{city}</span>
                                    </div>
                                ))}
                                {filteredCities.length === 0 && (
                                    <div className="text-center text-gray-400 py-4">No cities found. Try 'Surat'.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

function ToolbarBtn({ icon, label, color, onClick }: any) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-1 min-w-[70px] p-2 rounded-xl hover:bg-white dark:hover:bg-white/5 active:scale-95 transition-all">
            <div className={`p-3 rounded-full bg-white dark:bg-white/5 shadow-sm ${color}`}>{icon}</div>
            <span className="text-xs font-medium text-gray-500">{label}</span>
        </button>
    )
}