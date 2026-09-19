import Link from 'next/link';
import { Instagram, MessageCircle, MapPin } from 'lucide-react';

export default function Footer() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP || '918098232385';
  return (
    <footer className="bg-gradient-to-br from-brand-magenta to-brand-pink text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <h3 className="font-display text-2xl font-bold mb-2">Kavyajeni Fashions</h3>
          <p className="text-white/85 text-sm flex items-center gap-2">
            <MapPin size={16} /> Nagercoil, Kanyakumari District, Tamil Nadu
          </p>
          {/* <p className="text-white/70 text-xs mt-2">Online sales only</p> */}
        </div>

        {/* <div>
          <h4 className="font-semibold mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-white/85">
            <li><Link href="/category/salwar-set">Salwar Set</Link></li>
            <li><Link href="/category/umbrella-kurtis">Umbrella Kurtis</Link></li>
            <li><Link href="/category/nighties">Nighties</Link></li>
            <li><Link href="/category/innerwear">Innerwear</Link></li>
          </ul>
        </div> */}

        <div>
          <h4 className="font-semibold mb-3">Get in touch</h4>
          <div className="flex gap-3 mb-3">
            
             <a href="https://instagram.com/xx "
              target="_blank"
              rel="noreferrer"
              className="bg-white/15 p-2.5 rounded-full hover:bg-white/25"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            
             <a href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="bg-white/15 p-2.5 rounded-full hover:bg-white/25"
              aria-label="WhatsApp"
            >
              <MessageCircle size={18} />
            </a>
          </div>
          <p className="text-sm text-white/85">WhatsApp: +{whatsapp}</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/15 py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/70">
          <p>© {new Date().getFullYear()} Kavyajeni Fashions. All rights reserved.</p>

          
           <a href="https://www.nexirasolution.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-white transition-colors group"
          >
            <span>Designed & Developed by</span>
            <span className="bg-white text-brand-magenta font-bold text-[11px] px-2.5 py-1 rounded-full group-hover:bg-white/90 transition-colors tracking-wide">
              NEXIRA SOLUTION
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}