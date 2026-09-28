'use client';

// Floating WhatsApp button — fixed to the bottom-right corner, opens a chat
// with a pre-filled message. Drop <WhatsAppButton /> into your root layout
// (app/layout.js) so it shows on every page, or into a single page if you
// only want it there.
//
// Usage:
//   <WhatsAppButton />
//   <WhatsAppButton message="Hi, I have a question about my order" />
//
// `phone` must be in international format WITHOUT the leading + or 00
// (e.g. 91 for India + 10-digit number).

export default function WhatsAppButton({
  phone = '918098232385',
  message = 'Hi! I have a question.',
}) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    
     <a href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-5 z-40 md:bottom-5 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-lg hover:scale-105 active:scale-95 transition-transform"
    >
      <svg
        viewBox="0 0 32 32"
        width="30"
        height="30"
        fill="white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.362.687 4.564 1.872 6.417L4 29l7.79-1.84A11.94 11.94 0 0 0 16.001 27C22.63 27 28 21.627 28 15S22.63 3 16.001 3zm0 21.75c-1.964 0-3.79-.55-5.35-1.505l-.383-.228-4.62 1.092 1.108-4.505-.25-.397A9.71 9.71 0 0 1 5.25 15c0-5.936 4.815-10.75 10.751-10.75S26.75 9.064 26.75 15 21.937 24.75 16.001 24.75z"/>
        <path d="M21.72 17.99c-.297-.149-1.756-.867-2.028-.966-.272-.099-.47-.148-.668.149-.198.297-.767.965-.94 1.163-.173.198-.347.223-.644.074-.297-.149-1.253-.462-2.386-1.472-.882-.787-1.478-1.76-1.651-2.057-.173-.297-.019-.457.13-.605.134-.133.297-.347.446-.52.148-.173.198-.297.297-.495.099-.198.05-.372-.025-.52-.074-.149-.668-1.611-.916-2.206-.241-.579-.486-.5-.668-.51-.173-.008-.371-.01-.569-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.478 0 1.462 1.065 2.874 1.213 3.072.148.198 2.096 3.2 5.08 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.873.118.571-.085 1.756-.718 2.004-1.412.248-.694.248-1.288.173-1.412-.074-.124-.272-.198-.569-.347z"/>
      </svg>
    </a>
  );
}