import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function Home() {
  // Server-side cookie check
  const cookieStore = cookies();
  const isLoggedIn = cookieStore.get('is_logged_in')?.value === 'true';
  
  // if (isLoggedIn) {
  //   redirect('/EasyUse');
  // } else {
  //   redirect('/Login');
  // }

  redirect('/EasyUse');
}